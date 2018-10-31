import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import NBError from '../utils/NBError'

export default async (args: { coinName: string, cap: string }, ws: WebSocket) => {
  if (args.coinName !== cfg.CORE_TYPE) {
    throw new NBError(-30, `only support ${cfg.CORE_TYPE}`)
  }
  const tokenCfg = await cfg.loadTokenConfig(ws)
  const privKeyStr = await cfg.loadPrivKey(ws, tokenCfg.jadepool.hotPath)
  const privKey = Buffer.from(privKeyStr, 'hex')
  return Ledger.getInstance(ws).sweepToCold(tokenCfg.jadepool.hotAddress, tokenCfg.jadepool.coldAddress, args.cap, privKey)
}
