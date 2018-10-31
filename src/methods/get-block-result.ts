import WebSocket from 'ws'
import Ledger from '../ledger'
import NBError from '../utils/NBError'
// import * as cfg from '../configLoader'

export default async (args: { indexOrHash: number }, ws: WebSocket) => {
  if (!args.indexOrHash) {
    throw new NBError(-802, `missing indexOrHash`)
  }
  return Ledger.getInstance(ws).getBlockResult(args.indexOrHash)
}
