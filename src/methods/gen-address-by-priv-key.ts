import WebSocket from 'ws'
import { NBError, consts } from '@jadepool/lib-core'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import { ParamGenAddressByPrivKey } from '../types/params'

/**
 * 全新地址创建
 */
export default async (args: ParamGenAddressByPrivKey, ws: WebSocket): Promise<string> => {
  const ledger = Ledger.getInstance(ws)

  if (consts.ADDRESS_TYPE.HOT_WALLET === args.addressType) {
    let keyBuffer: Buffer = Buffer.from(args.privKey, 'hex')
    return ledger.genAddressByPrivKey(keyBuffer)
  } else if (consts.ADDRESS_TYPE.DEPOSIT === args.addressType) {
    const info = await cfg.loadWalletAddress(ws, args.wallet, consts.ADDRESS_TYPE.HOT_WALLET, false)
    return ledger.genAddressByHotAndIdx(info.address, args.index)
  } else {
    throw new NBError(-805, `missing parameter: index`)
  }
}
