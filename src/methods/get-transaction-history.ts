import WebSocket from 'ws'
import Ledger from '../ledger'
import NBError from '../utils/NBError'
// import * as cfg from '../configLoader'

export default async (args: { address: string }, ws: WebSocket) => {
  if (!args.address) {
    throw new NBError(-800, `missing address`)
  }
  return Ledger.getInstance(ws).getTransactionHistory(args.address)
}
