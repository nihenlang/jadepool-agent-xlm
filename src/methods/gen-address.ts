import WebSocket from 'ws'
import Ledger from '../ledger'
import { services } from '../services/core'
import NBError from '../utils/NBError'

/**
 * 全新地址创建
 */
export default async (args: { path: string, index?: number }, ws: WebSocket): Promise<string> => {
  let privKey: Buffer | undefined
  if (args.path !== '') {
    const jsonRpcSrv = services.get('jsonrpc')
    const privKeyStr = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-privkey', { path: args.path })
    if (!privKeyStr) {
      throw new NBError(-998, `failed to fetch privkey`)
    }
    privKey = Buffer.from(privKeyStr, 'hex')
  }
  return Ledger.getInstance(ws).genAddress(privKey, args.index)
}
