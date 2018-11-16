import WebSocket from 'ws'
import Ledger from '../ledger'
import NBError from '../utils/NBError'

export default async (args: { indexOrHash: number }, ws: WebSocket) => {
  if (!args.indexOrHash) {
    throw new NBError(-802, `missing indexOrHash`)
  }
  return Ledger.getInstance(ws).getBlock(args.indexOrHash)
}
