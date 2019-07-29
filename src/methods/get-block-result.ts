import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamBlockResult } from '../types/params'

export default async (args: ParamBlockResult, ws: WebSocket) => {
  if (!args.indexOrHash) {
    throw new NBError(-802, `missing indexOrHash`)
  }
  return Ledger.getInstance(ws).getBlockResult(args.indexOrHash)
}
