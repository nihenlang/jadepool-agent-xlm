import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'

export default async (args: { txns: any[], bn?: number, hasScanTask?: boolean }, ws: WebSocket) => {
  const tokenCfg = await cfg.loadTokenConfig(ws)
  return Ledger.getInstance(ws).filterTransactions(tokenCfg.jadepool.hotAddress, args.txns, args.bn, args.hasScanTask)
}
