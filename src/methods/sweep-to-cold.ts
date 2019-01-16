import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import * as cfg from '../configLoader'

export default async (args: { coinName: string, cap: string }, ws: WebSocket) => {
  if (args.coinName !== cfg.CORE_TYPE) {
    throw new NBError(-830, `only support ${cfg.CORE_TYPE}`)
  }
  const ledger = Ledger.getInstance(ws)
  const tokenCfg = await ledger.getTokenConfig()
  const privKeyStr = await cfg.loadPrivKey(ws, tokenCfg.jadepool.hotPath)
  const privKey = Buffer.from(privKeyStr, 'hex')
  return ledger.sweepToCold(tokenCfg.jadepool.hotAddress, tokenCfg.jadepool.coldAddress, args.cap, privKey)
}
