import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'

export default async (args: { info: any, bn?: number }, ws: WebSocket) => {
  if (!args.info) {
    throw new NBError(-803, `missing info`)
  }
  return Ledger.getInstance(ws).getOrderState(args.info, args.bn)
}
