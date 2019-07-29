import StellarSdk from 'stellar-sdk'
import { TxResult } from './results'

export interface ParamFillTransaction {
  txn: any
  bn: number
  timestamp: number
}

interface FilledTx extends TxResult {
  records: StellarSdk.Server.OperationRecord[]
}

export interface ParamFilterIncomingTransactions {
  txns: FilledTx[]
  bn?: number
  hasScanTask?: boolean
  wallet: string
  hotAddress: string
  coldAddress: string
}

export interface ParamGenAddressByPrivKey {
  wallet: string
  privKey: string
  index: number
  coinName: string
  addressType: number
  bizMode: string
}

export interface ParamGetBalance {
  wallet: string
  address: string
  coinName: string
}

export interface ParamBlockResult {
  indexOrHash: number
}

export interface OrderInfo {
  wallet: string
  txid: string
  coinName: string
  meta?: string
  block?: number
}

export interface ParamGetOrderState {
  wallet: string
  info: OrderInfo
  bn?: number
}

export interface ParamOnlyAddress {
  address: string
}
export type ParamGetTransactionHistory = ParamOnlyAddress
export type ParamValidateAddress = ParamOnlyAddress

export interface ParamGetTransactionState {
  wallet: string
  info: OrderInfo
  bn?: number
}

export interface OutInfo {
  id: number
  from: string
  to: string
  value: string
  actionMemo?: string
}

export interface ParamSweepToCold {
  wallet: string
  coinName: string
  cap: string
  order: OutInfo
}

export interface ParamWithdraw {
  wallet: string
  coinName: string
  outputs: OutInfo[]
}
