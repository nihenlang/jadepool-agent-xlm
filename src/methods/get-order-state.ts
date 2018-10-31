import WebSocket from 'ws'
import Ledger from '../ledger'
// import * as cfg from '../configLoader'

export default async (args: { info: any, bn?: number }, ws: WebSocket) => {
  return Ledger.getInstance(ws).getOrderState(args.info, args.bn)
}
