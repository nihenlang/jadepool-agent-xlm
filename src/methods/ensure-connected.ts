import WebSocket from 'ws'
import Ledger from '../ledger'

export default async (args: any, ws: WebSocket) => {
  const ledger = Ledger.getInstance(ws)
  const isConnected = ledger.isConnected
  if (!isConnected) {
    ledger.getBlockNumber()
  }
  return isConnected
}
