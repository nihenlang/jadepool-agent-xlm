import WebSocket from 'ws'
import { NBError } from '@jadepool/lib-core'
import Ledger from '../ledger'

export default async (args: { address: string, coinName: string }, ws: WebSocket) => {
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
