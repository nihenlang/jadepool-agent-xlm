import WebSocket from 'ws'
import Ledger from '../ledger'
// import * as cfg from '../configLoader'

export default async (args: { indexOrHash: number }, ws: WebSocket) => {
  return Ledger.getInstance(ws).getBlockResult(args.indexOrHash)
}
