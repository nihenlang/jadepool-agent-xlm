import WebSocket from 'ws'
import _ from 'lodash'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import Logger from '../utils/logger'
import NBError from '../utils/NBError'

/**
 * @param methodName 调用的方法名
 * @param args 参数名
 * @param ws 调用该方法的socketClient
 */
export default async (methodName: string, args: object = {}, ws: WebSocket) => {
  // 准备LedgerClient
  const ledger = Ledger.getInstance(ws)
  if (!ledger.isInitialized) {
    await ledger.getChainConfig()
  }
  // 进行函数调用
  try {
    let functionImpl = await import(`./${_.kebabCase(methodName)}`)
    if (typeof functionImpl.default === 'function') {
      functionImpl = functionImpl.default
    }
    if (typeof functionImpl === 'function') {
      Logger.of('Methods').tag(`Invoke:${methodName}`).logObj(args)
      return functionImpl(args, ws)
    } else {
      throw new NBError(404, `method should be a function`)
    }
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new NBError(404, `missing method ${methodName}.`)
    } else {
      throw err
    }
  }
}
