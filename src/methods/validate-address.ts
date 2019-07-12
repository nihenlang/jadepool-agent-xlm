import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamValidateAddress } from '../types/params'

export default async (args: ParamValidateAddress, ws: WebSocket) => {
  if (!args.address) {
    throw new NBError(-801, `missing address`)
  }
  return Ledger.getInstance(ws).validateAddress(args.address)
}
