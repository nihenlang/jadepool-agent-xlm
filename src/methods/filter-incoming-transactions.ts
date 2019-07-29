import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamFilterIncomingTransactions } from '../types/params'

export default async (args: ParamFilterIncomingTransactions, ws: WebSocket) => {
  if (!args.txns || !Array.isArray(args.txns)) {
    throw new NBError(-810, `missing txns`)
  }
  if (!args.hotAddress || !args.wallet || !args.coldAddress) {
    throw new NBError(-811, `missing wallet`)
  }
  return Ledger.getInstance(ws).filterTransactions(args)
}
