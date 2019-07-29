import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamGetTransactionState } from '../types/params'

export default async (args: ParamGetTransactionState, ws: WebSocket) => {
  if (!args.info) {
    throw new NBError(-803, `missing info`)
  }
  return Ledger.getInstance(ws).getTransactionState(args.info, args.bn)
}
