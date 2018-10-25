import WebSocket from 'ws'
import _ from 'lodash'
import Ledger from '../ledger'
import { services } from '../services/core'
import Logger from '../utils/logger'
import NBError from '../utils/NBError'

/**
 * 可调用瑶池的RPC为
 * 'rpc-fetch-chaincfg',
 * 'rpc-fetch-coincfg',
 * 'rpc-fetch-privkey'
 * @param methodName 调用的方法名
 * @param args 参数名
 * @param ws 调用该方法的socketClient
 */
export default async (methodName: string, args: object = {}, ws: WebSocket) => {
  const jsonRpcSrv = services.get('jsonrpc')
  // 准备LedgerClient
  const ledger = Ledger.getInstance(ws)
  if (!ledger.isInitialized) {
    const cfgData = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-chaincfg', { chain: Ledger.CHAIN_KEY })
    if (!cfgData || !cfgData.node || cfgData.ChainIndex === undefined) {
      throw new NBError(500, `failed to initialize ledger`)
    }
    const nodeData: any = _.find(cfgData.node, { name: Ledger.CHAIN_KEY })
    ledger.chainConfig = {
      chainIndex: cfgData.ChainIndex,
      endpoints: Ledger.IS_TESTNET ? nodeData.TestNet : nodeData.MainNet
    }
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
