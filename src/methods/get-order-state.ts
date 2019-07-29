import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamGetOrderState } from '../types/params'

export default async (args: ParamGetOrderState, ws: WebSocket) => {
  if (!args.info) {
    throw new NBError(-803, `missing info`)
  }
  return Ledger.getInstance(ws).getOrderState(args.info, args.bn)
}
