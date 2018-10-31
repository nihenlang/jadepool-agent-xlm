import WebSocket from 'ws'
import Ledger from '../ledger'
import * as cfg from '../configLoader'
import NBError from '../utils/NBError'

export default async (args: { txns: any[], bn?: number, hasScanTask?: boolean }, ws: WebSocket) => {
  if (!args.txns || !Array.isArray(args.txns)) {
    throw new NBError(-810, `missing txns`)
  }
  const tokenCfg = await cfg.loadTokenConfig(ws)
  return Ledger.getInstance(ws).filterTransactions(tokenCfg.jadepool.hotAddress, args.txns, args.bn, args.hasScanTask)
}
