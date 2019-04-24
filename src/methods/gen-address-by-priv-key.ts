import WebSocket from 'ws'
import { NBError, consts } from '@jadepool/lib-core'
import Ledger from '../ledger'

/**
 * 全新地址创建
 */
export default async (args: { privKey: string, index: number, coinName: string, addressType: number, bizMode: string }, ws: WebSocket): Promise<string> => {
  const ledger = Ledger.getInstance(ws)

  if (consts.ADDRESS_TYPE.HOT_WALLET === args.addressType) {
    let keyBuffer: Buffer = Buffer.from(args.privKey, 'hex')
    return ledger.genAddress(keyBuffer)
  } else if (consts.ADDRESS_TYPE.DEPOSIT === args.addressType) {
    const tokenCfg = await ledger.getTokenConfig()
    const opts = { mainAddress: tokenCfg.jadepool.hotAddress, index: args.index }
    return ledger.genAddress(undefined, opts)
  } else {
    throw new NBError(-805, `missing parameter: index`)
  }
}
