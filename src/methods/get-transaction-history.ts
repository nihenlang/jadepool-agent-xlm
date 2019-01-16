import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'

export default async (args: { address: string }, ws: WebSocket) => {
  if (!args.address) {
    throw new NBError(-801, `missing address`)
  }
  return Ledger.getInstance(ws).getTransactionHistory(args.address)
}
