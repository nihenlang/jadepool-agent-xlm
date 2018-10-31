import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import NBError from '../utils/NBError'

export default async (args: { coinName: string, outputs: any[] }, ws: WebSocket) => {
  if (args.coinName !== cfg.CORE_TYPE) {
    throw new NBError(-830, `only support ${cfg.CORE_TYPE}`)
  }
  const tokenCfg = await cfg.loadTokenConfig(ws)
  const privKeyStr = await cfg.loadPrivKey(ws, tokenCfg.jadepool.hotPath)
  const privKey = Buffer.from(privKeyStr, 'hex')
  return Ledger.getInstance(ws).withdraw(tokenCfg.jadepool.hotAddress, args.outputs, privKey)
}
