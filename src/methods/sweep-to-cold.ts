import WebSocket from 'ws'
import { consts, NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import { ParamSweepToCold } from '../types/params'

export default async (args: ParamSweepToCold, ws: WebSocket) => {
  if (args.coinName !== cfg.CORE_TYPE) {
    throw new NBError(-830, `only support ${cfg.CORE_TYPE}`)
  }
  const ledger = Ledger.getInstance(ws)
  const result = await cfg.loadWalletAddress(ws, args.wallet, consts.ADDRESS_TYPE.HOT_WALLET, true)
  if (!result.privKey) {
    throw new NBError(-831, `missing private key`)
  }
  const privKey = Buffer.from(result.privKey, 'hex')
  return ledger.sweepToCold(result.address, args.order.to, args.cap, privKey)
}
