import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'

export default async (args: { indexOrHash: number }, ws: WebSocket) => {
  if (!args.indexOrHash) {
    throw new NBError(-802, `missing indexOrHash`)
  }
  return Ledger.getInstance(ws).getBlock(args.indexOrHash)
}
