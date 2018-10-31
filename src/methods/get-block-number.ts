import WebSocket from 'ws'
import Ledger from '../ledger'
// import * as cfg from '../configLoader'

export default async (args: any, ws: WebSocket) => {
  return Ledger.getInstance(ws).getBlockNumber()
}
