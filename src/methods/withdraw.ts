import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import NBError from '../utils/NBError'

export default async (args: { coinName: string, outputs: any[] }, ws: WebSocket) => {
  if (args.coinName !== cfg.CORE_TYPE) {
    throw new NBError(-830, `only support ${cfg.CORE_TYPE}`)
  }
  const ledger = Ledger.getInstance(ws)
  const tokenCfg = await ledger.getTokenConfig()
  const privKeyStr = await cfg.loadPrivKey(ws, tokenCfg.jadepool.hotPath)
  const privKey = Buffer.from(privKeyStr, 'hex')
  return ledger.withdraw(tokenCfg.jadepool.hotAddress, args.outputs, privKey)
}
