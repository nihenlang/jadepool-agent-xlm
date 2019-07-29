import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamGetTransactionHistory } from '../types/params'

export default async (args: ParamGetTransactionHistory, ws: WebSocket) => {
  if (!args.address) {
    throw new NBError(-801, `missing address`)
  }
  return Ledger.getInstance(ws).getTransactionHistory(args.address)
}
