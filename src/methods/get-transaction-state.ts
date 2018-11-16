import WebSocket from 'ws'
import Ledger from '../ledger'
import NBError from '../utils/NBError'

export default async (args: { info: any, bn?: number }, ws: WebSocket) => {
  if (!args.info) {
    throw new NBError(-803, `missing info`)
  }
  return Ledger.getInstance(ws).getTransactionState(args.info, args.bn)
}
