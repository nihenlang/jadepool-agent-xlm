import WebSocket from 'ws'
import Ledger from '../ledger'
import { ParamFillTransaction } from '../types/params'

export default async (args: ParamFillTransaction, ws: WebSocket) => {
  return Ledger.getInstance(ws).fillTransaction(args)
}
