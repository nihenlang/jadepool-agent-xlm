
/** TxData 对象 */
export type TxEffectData = {
  address: string,
  value: string,
  txid?: string,
  n?: number,
  asset?: string
}

export interface TxData {
  type: string
  hash: string
  blockHash: string
  fee: string
  blockNumber: number
  confirmations: number
  from: TxEffectData[]
  to: TxEffectData[]
}

/**
 * 充值对象
 */
export interface IncomingRecord {
  wallet: string
  txid: string
  meta: string
  bn: number
  coreType: string
  coinName: string
  fromAddress: string
  toAddress: string
  value: string
  n: number
  // state判定
  isUnexpected: boolean
  isSpecial: boolean
  isInternal: boolean
}

/** 交易结果 */
export interface TxResult {
  txid: string
  meta?: string
  [key: string]: any
}
export interface OrderState {
  found: boolean
  block?: number
  fee?: string
  state?: 'online' | 'pending' | 'failed'
  message?: string
}
export interface BlockResult {
  hash: string,
  timestamp: number,
  txns: TxResult[]
}
export interface OrderSentResult extends TxResult {
  error?: string
  orderIds?: number[]
}
