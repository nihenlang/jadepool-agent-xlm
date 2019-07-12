import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'
import { ParamGetBalance } from '../types/params'

export default async (args: ParamGetBalance, ws: WebSocket) => {
  if (!args.address) {
    throw new NBError(-801, `missing address`)
  }
  let balance: string
  try {
    balance = await Ledger.getInstance(ws).getBalance(args.address, args.coinName)
  } catch (err) {
    balance = '0'
  }
  return balance
}
