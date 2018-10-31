import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import NBError from '../utils/NBError'

/**
 * 全新地址创建
 */
export default async (args: { path: string, index?: number }, ws: WebSocket): Promise<string> => {
  const ledger = Ledger.getInstance(ws)

  let privKey: Buffer | undefined
  let opts
  if (args.path !== '') {
    const privKeyStr = await cfg.loadPrivKey(ws, args.path)
    privKey = Buffer.from(privKeyStr, 'hex')
  } else if (args.index !== undefined) {
    const tokenCfg = await ledger.getTokenConfig()
    opts = { mainAddress: tokenCfg.jadepool.hotAddress, index: args.index }
  } else {
    throw new NBError(-805, `missing parameter: index`)
  }
  return ledger.genAddress(privKey, opts)
}
