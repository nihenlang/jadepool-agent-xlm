import _ from 'lodash'
import uuid from 'uuid'
import WebSocket from 'ws'
import config from 'config'
import { EventEmitter } from 'events'
import { IncomingMessage } from 'http'
import core from './core'
import BaseService from './base.service'
import invokeMethod from '../methods'
import Logger from '../utils/logger'
import { ecc } from '../utils/crypto'

const logger = Logger.of('Service', 'JsonRPC')

type AcceptMethods = { acceptMethods?: string | string[] }

type JSONRPCRequest = {
  jsonrpc: '2.0',
  id?: string,
  method: string,
  params: object | Array<any>
}
type ErrorObject = {
  code: number,
  message: string
}
type JSONRPCResponse = {
  jsonrpc: '2.0',
  id?: string,
  result?: object,
  error?: ErrorObject
}

/**
 * 基于ws的通用jsonrpc发送和接收服务
 * 1.支持保持对多个地址服务调用jsonrpc
 * 2.支持将本地methods包装为jsonrpc服务，暴露给连接对象
 */
class JSONRPCService extends BaseService {
  /**
   * 调用请求的Map
   */
  private readonly requests: Map<string, EventEmitter>
  /**
   * Websocket服务端
   */
  private readonly wss: WebSocket.Server
  /**
   * 可接受的方法调用
   */
  private acceptMethods: string[] = []
  /**
   * 构造函数
   */
  constructor (services: core.ServiceLib) {
    super('jsonrpc', services)
    this.requests = new Map()
    this.wss = new WebSocket.Server({
      port: config.get('port'),
      verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }): boolean => {
        if (!info.req.headers || !info.req.headers.authorization) {
          logger.warn(`missing headers.authorization. client: ${info.origin}`)
          return false
        }
        if (!ecc.verifyFromJadepool(info.req.headers.authorization)) {
          logger.warn(`authorization failed. client: ${info.origin}`)
          return false
        }
        return true
      }
    })
  }
  /**
   * 销毁
   */
  async onDestroy () {
    this.wss.clients.forEach(ws => {
      ws.removeAllListeners()
      ws.terminate()
    })
  }
  /**
   * 初始化
   */
  async initialize (opts: AcceptMethods) {
    // 定义acceptMethods
    let methods: string[] = []
    if (opts.acceptMethods) {
      if (typeof opts.acceptMethods === 'string') {
        methods = opts.acceptMethods.split(',')
      } else if (Array.isArray(opts.acceptMethods)) {
        methods = opts.acceptMethods
      }
    }
    this.acceptMethods = methods
    // 设置Websocket.Server的事件监听
    this.wss.on('connection', (client: WebSocket) => {
      client
      .addListener('close', (code, reason) => {
        logger.tag('Closed').log(`reason=${reason},code=${code}`)
      })
      .addListener('message', data => {
        logger.tag('Message').log(`data=${data.toString()}`)
        this._handleRPCMessage(client, data.valueOf())
      })
    })
  }
  /**
   * 请求RPC地址
   * @param client 请求的客户端
   * @param methodName 方法名
   * @param args 参数
   */
  async requestJSONRPC (ws: WebSocket, methodName: string, args: object) {
    if (!ws || ws.readyState !== ws.OPEN) {
      logger.tag('Request').warn(`method=${methodName},args=${JSON.stringify(args)}`)
      throw new Error(`client isn't opened`)
    }
    const reqData = {
      jsonrpc: '2.0',
      id: uuid.v1(),
      method: methodName,
      params: args
    }
    const emitter = new EventEmitter()
    this.requests.set(reqData.id, emitter)
    // 发起并等待请求
    const result = await new Promise<any>((resolve, reject) => {
      // 发起请求
      ws.send(JSON.stringify(reqData), err => reject(err instanceof Error ? err : new Error(err)))
      // 监听回调
      emitter.once('response', resolve)
      emitter.once('error', reject) // reject将自动throw error
    })
    // 移除Emitter依赖
    emitter.removeAllListeners()
    this.requests.delete(reqData.id)
    // 返回结果
    return result
  }

  /**
   * 消息处理函数
   * @param data 明确为string类型, 即JSONRpc的传输对象
   * @param ws 处理用的websocket客户端
   */
  private async _handleRPCMessage (ws: WebSocket, data: any) {
    let jsonData: JSONRPCRequest | JSONRPCResponse
    try {
      jsonData = JSON.parse(data)
    } catch (err) {
      return
    }
    if (jsonData.jsonrpc !== '2.0') {
      logger.tag('RPC Message').warn(`only accept JSONRPC 2.0 instead of "${jsonData.jsonrpc}"`)
      return
    }
    // 请求类型判断
    let jsonRequest = jsonData as JSONRPCRequest
    if (jsonRequest.method !== undefined) {
      // 判断是否为方法调用或通知，将进行本地调用
      const result = await this._invokeInternalMethod(jsonRequest.method, jsonRequest.params || {})
      // 若为方法调用, 则需返回结果
      if (jsonRequest.id) {
        result.jsonrpc = '2.0'
        result.id = jsonRequest.id
        ws.send(JSON.stringify(result), err => logger.error(null, err))
      }
      return
    }
    // 回调类型判断
    let jsonResponse = jsonData as JSONRPCResponse
    if (jsonResponse.id !== undefined && (jsonResponse.result !== undefined || jsonResponse.error !== undefined)) {
      // 判断是否为回调请求，若为回调请求则需返回结果到请求Promise
      const emiter = this.requests.get(jsonResponse.id)
      if (!emiter) {
        logger.tag('RPC Message').warn(`unknown id ${jsonResponse.id}`)
        return
      }
      if (jsonResponse.result !== undefined) {
        emiter.emit('response', jsonResponse.result)
      } else if (jsonResponse.error !== undefined) {
        emiter.emit('error', jsonResponse.error)
      }
      return
    }
    // 无任何解析的情况，直接打印warning
    logger.warn(`unknown data`)
  }

  /**
   * 进行内方法调用的实际执行函数
   * @param methodName
   * @param args
   */
  private async _invokeInternalMethod (methodName: string, args: object) {
    let ret: JSONRPCResponse = { jsonrpc: '2.0' }
    // 检测方法名是否可用
    methodName = _.kebabCase(methodName)
    if (this.acceptMethods.indexOf(methodName) === -1) {
      ret.error = { code: 404, message: 'Method not found.' }
    } else {
      // 进行本地调用
      try {
        ret.result = await invokeMethod(methodName, args)
      } catch (err) {
        ret.error = { code: err.code, message: err.message }
      }
    }
    logger.tag('RPC Invoke').log(`method=${methodName},args=${JSON.stringify(args)}`)
    return ret
  }
}

export = JSONRPCService
