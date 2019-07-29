import WebSocket from 'ws'
import Ledger from '../ledger'

export default async (args: any, ws: WebSocket) => {
  return Ledger.getInstance(ws).getBlockNumber()
}
