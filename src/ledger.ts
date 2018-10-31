import WebSocket from 'ws'
import moment from 'moment'
import BigNumber from 'bignumber.js'
import StellarSdk from 'stellar-sdk'
import * as cfg from './configLoader'
import NBError from './utils/NBError'
import Logger from './utils/logger'

const logger = Logger.of('Ledger', 'Stellar')

// Interface and Types
/** TxData 对象 */
type TxEffectData = {
  address: string,
  value: string,
  txid?: string,
  n?: number,
  asset?: string
}
interface TxData {
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
 * 提现信息
 */
interface OutInfo {
  to: string
  value: string
  memo?: string
  id?: number
}
/**
 * 充值对象
 */
interface IncomingRecord {
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
interface TxResult {
  txid: string
  meta?: string
  [key: string]: any
  // block: number
  // from: string
  // from_seq: number
  // fee: string,
}
interface OrderInfo {
  txid: string
  coinName: string
  meta?: string
  block?: number
}
interface OrderState {
  found: boolean
  block?: number
  fee?: string
  state?: 'online' | 'pending' | 'failed'
  message?: string
}
interface BlockResult {
  hash: string,
  timestamp: number,
  txns: TxResult[]
}
/** 提现结果 */
interface WithdrawResult extends TxResult {
  orderIds: number[]
}
/** 热转冷结果 */
interface SweepToColdResult extends TxResult {
  to?: string
  value?: string
}
// 常量
const FEE_PER_STROOP = new BigNumber(0.00001).div(100).toString()

// Export class
export default class Ledger {
  /**
   * 静态方法
   */
  private static _instances: WeakMap<WebSocket, Ledger> = new WeakMap<WebSocket, Ledger>()

  static getInstance (ws: WebSocket): Ledger {
    let ledger = Ledger._instances.get(ws)
    if (!ledger) {
      ledger = new Ledger()
      Ledger._instances.set(ws, ledger)
    }
    return ledger
  }

  // Members
  private _chainConfig?: cfg.ChainConfig
  private _sdk?: StellarSdk.Server
  private _closeLedgerListener?: () => void
  private _ledgersCache: Map<number, StellarSdk.LedgerRecord> = new Map<number, StellarSdk.LedgerRecord>()
  private _latestLedgerNumber: number = -1

  // Constructor
  private constructor () {
    if (cfg.IS_TESTNET) {
      StellarSdk.Network.useTestNetwork()
    } else {
      StellarSdk.Network.usePublicNetwork()
    }
  }

  /**
   * Private Methods
   */
  private _ensureChainConfig (): cfg.ChainConfig {
    if (!this._chainConfig) {
      throw new NBError(-10, `missing chain config. ledger isn't initialized`)
    } else {
      return this._chainConfig
    }
  }

  private _handleIncomingLedger (ledgerRecord: StellarSdk.LedgerRecord): void {
    logger.tag('NewRecord').log(`ledger=${ledgerRecord.sequence},hash=${ledgerRecord.hash}`)
    if (ledgerRecord.sequence > this._latestLedgerNumber) {
      this._latestLedgerNumber = ledgerRecord.sequence
    }
    this._ledgersCache.set(ledgerRecord.sequence, ledgerRecord)
  }

  private _splitAddress (address: string) {
    const accountReg = /^([^[]*)(\[(.*)\])?$/i
    const regMat = address.replace(/\n/g, '').match(accountReg)
    return regMat ? {
      account: regMat[1],
      memo: regMat[3] || ''
    } : {
      account: address,
      memo: ''
    }
  }

  private async _resolveAccountId (address: string) {
    if (address.indexOf('*') > -1) {
      const fedRecord = await StellarSdk.FederationServer.resolve(address)
      return fedRecord.account_id
    }
    return address
  }

  private async _loadAccount (address: string) {
    let accountId = await this._resolveAccountId(address)
    return this.sdk.loadAccount(accountId)
  }

  /**
   * 发送交易
   */
  private async _trySendTransaction (output: OutInfo, from: string, seq: string, privKey: Buffer): Promise<WithdrawResult | SweepToColdResult | null> {
    const account = new StellarSdk.Account(from, seq)
    const builder = new StellarSdk.TransactionBuilder(account)
      .addOperation(StellarSdk.Operation.payment({
        destination: output.to,
        asset: StellarSdk.Asset.native(),
        amount: output.value
      }))
    if (output.memo) {
      builder.addMemo(StellarSdk.Memo.text(output.memo))
    }
    let txResult: WithdrawResult | SweepToColdResult | null = null
    try {
      const transaction = builder.build()
      transaction.sign(StellarSdk.Keypair.fromRawEd25519Seed(privKey))
      const txid = transaction.hash().toString('hex')
      logger.tag('Signed').log(`txid=${txid}`)
      // 发送Transaction
      const result = await this.sdk.submitTransaction(transaction)
      // 导出txResult
      txResult = {
        txid: result.hash || txid,
        meta: seq.toString(),
        orderIds: output.id ? [output.id] : []
      }
    } catch (err) {
      throw err
    }
    return txResult
  }

  /**
   * Accessors
   */
  get isInitialized () { return !!this._chainConfig }
  get sdk (): StellarSdk.Server {
    if (!this._sdk) {
      if (!this._chainConfig) {
        throw new NBError(-1, `missing chain config. ledger isn't initialized`)
      }
      this._sdk = new StellarSdk.Server(this._chainConfig.endpoints[0])
    }
    return this._sdk
  }
  get isConnected (): boolean { return this._latestLedgerNumber !== -1 && this._closeLedgerListener !== undefined }

  /**
   * Public Methods
   */
  updateChainConfig (chainCfg: cfg.ChainConfig) {
    this._chainConfig = chainCfg
    this._sdk = undefined
  }
  /**
   * 获取用户地址
   * @param privKey 私钥
   * @param index 用户index
   */
  genAddress (privKey?: Buffer, opts?: { mainAddress: string, index: number }): string {
    const chainCfg = this._ensureChainConfig()
    let hotAddress: string | undefined
    if (!privKey && opts) {
      hotAddress = opts.mainAddress
    } else if (privKey) {
      if (privKey.length !== 32) {
        throw new NBError(-999, `privKey length should be 32`)
      }
      const keypair = StellarSdk.Keypair.fromRawEd25519Seed(privKey)
      hotAddress = keypair.publicKey()
    } else {
      throw new NBError(-800, `missing parameter`)
    }
    // 若不存在index，则返回热主地址
    if (opts === undefined) {
      return hotAddress
    } else {
      // 普通充值地址的创建
      const chainIndex = (chainCfg.chainIndex || 1) * 10000
      return hotAddress + `[${chainIndex + opts.index}]`
    }
  }

  /**
   * 验证地址
   * @param address
   */
  async validateAddress (address: string): Promise<boolean> {
    try {
      const federationRecord = await StellarSdk.FederationServer.resolve(address)
      return federationRecord && federationRecord.account_id ? true : false
    } catch (err) {
      return false
    }
  }

  /**
   * 获取最新区块高度
   */
  async getBlockNumber (): Promise<number> {
    if (!this._closeLedgerListener) {
      this._closeLedgerListener = this.sdk.ledgers().cursor('now').stream({
        onmessage: this._handleIncomingLedger.bind(this),
        onerror: err => {
          logger.warn(`info=stream disconnected at(${this._latestLedgerNumber}),err=${err.message || err.name}`)
          if (this._closeLedgerListener) {
            this._closeLedgerListener()
            this._closeLedgerListener = undefined
          }
        }
      })
    }
    return this._latestLedgerNumber
  }

  /**
   * 获取地址余额, 此处是除以Decimals Rate的显示值
   * @param address 查询地址
   * @param coinName 币种名称
   */
  async getBalance (address: string, coinName?: string): Promise<string> {
    const account = await this._loadAccount(address)
    const balanceObj = account.balances.find(item => item.asset_type === 'native')
    if (balanceObj) {
      return balanceObj.balance
    }
    return '-1'
  }

  /**
   * 获取区块信息
   * @param indexOrHash 区块高度
   */
  async getBlock (index: number): Promise<StellarSdk.LedgerRecord | undefined> {
    let ledgerRecord = this._ledgersCache.get(index)
    if (!ledgerRecord) {
      const result = await this.sdk.ledgers().cursor(index.toString()).limit(1).call()
      if (result.records.length > 0) {
        ledgerRecord = result.records[0]
      }
    }
    return ledgerRecord
  }

  /**
   * 获取交易状态信息
   * @param info 订单情况
   * @param bn 当前区块号
   */
  async getOrderState (info: OrderInfo, bn?: number): Promise<OrderState> {
    let ret: OrderState
    try {
      const tranx = ((await this.sdk.transactions().transaction(info.txid).call()) as any) as StellarSdk.TransactionRecord
      ret = { found: true, state: 'pending' }
      ret.block = tranx.ledger_attr
      ret.fee = new BigNumber(tranx.fee_paid).times(FEE_PER_STROOP).toString()
    } catch (err) {
      logger.error(`failed to get tx`, err)
      ret = { found: false }
    }
    return ret
  }

  /**
   * 获取Transaction具体信息
   * @param info 订单情况
   * @param bn 当前区块号
   */
  async getTransactionState (info: OrderInfo, bn?: number): Promise<TxData | undefined> {
    let tranx: StellarSdk.TransactionRecord
    try {
      tranx = ((await this.sdk.transactions().transaction(info.txid).call()) as any) as StellarSdk.TransactionRecord
    } catch (err) {
      return undefined
    }
    const effects = await tranx.effects()
    let from: TxEffectData[] = []
    let to: TxEffectData[] = []
    if (effects && effects._embedded && effects._embedded.records) {
      effects._embedded.records.forEach(effect => {
        switch (effect.type) {
          case 'account_created':
            to.push({
              address: effect.account,
              value: effect.starting_balance
            })
            break
          case 'account_debited':
            if ((effect as any).asset_type !== 'native') return
            from.push({
              address: effect.account,
              value: (effect as any).amount
            })
            break
          case 'account_credited':
            if ((effect as any).asset_type !== 'native') return
            to.push({
              address: effect.account,
              value: (effect as any).amount
            })
        }
      })
    }
    return {
      type: cfg.CORE_TYPE,
      hash: tranx.hash,
      blockNumber: tranx.ledger_attr,
      blockHash: tranx.ledger_attr.toString(),
      confirmations: bn ? bn - tranx.ledger_attr : 0,
      fee: new BigNumber(tranx.fee_paid).times(FEE_PER_STROOP).toString(),
      from,
      to
    }
  }

  /**
   * 筛选出系统所需的订单
   * @param hotAddress 热钱包地址
   * @param txns 从区块链获取的交易信息
   * @param bn 可选参数，这些txns所在的区块号
   * @param hasScanTask 可选参数，是否为扫描任务
   */
  async filterTransactions (hotAddress: string, txns: TxResult[], bn?: number, hasScanTask?: boolean): Promise<IncomingRecord[]> {
    let incomingRecords: IncomingRecord[] = []
    await Promise.all(txns.map(async txn => {
      // 使用官方payments相关内容获
      let payments: StellarSdk.CollectionPage<StellarSdk.OperationRecord> | undefined
      try {
        payments = await this.sdk.payments().forTransaction(txn.txid).call()
      } catch (err) {
        logger.tag('failed-to-load-payments').warn(`txid=${txn.txid}`)
      }
      // 找遍全部的records
      let idx = 0
      while (payments && payments.records.length > 0) {
        // 扫描记录
        payments.records.forEach(paymentRecord => {
          let to = ''
          let value = ''
          let assetType = 'native'
          let from = txn.from
          switch (paymentRecord.type) {
            case 'create_account':
              from = paymentRecord.funder
              to = paymentRecord.account
              value = paymentRecord.starting_balance
              break
            case 'payment':
              from = paymentRecord.from
              to = paymentRecord.to
              value = paymentRecord.amount
              assetType = paymentRecord.asset_type
              break
            case 'path_payment':
              from = paymentRecord.from
              to = paymentRecord.to
              value = paymentRecord.amount
              assetType = paymentRecord.asset_type
              break
            default:
              return
          }
          // 过滤仅提取瑶池相关交易
          if (to !== hotAddress) return
          // 过滤仅提取native币交易
          if (assetType !== 'native') return
          const toName = txn.memo ? hotAddress + `[${txn.memo}]` : hotAddress
          // 组织Incoming对象
          incomingRecords.push({
            txid: txn.txid,
            meta: '',
            bn: txn.block,
            coreType: cfg.CORE_TYPE,
            coinName: cfg.CORE_TYPE,
            fromAddress: from,
            toAddress: toName,
            value: value,
            n: idx++,
            // state判定均为false
            isInternal: false,
            isSpecial: false,
            isUnexpected: false
          })
        }) // end foreach
        // 查找剩余的payments
        payments = await payments.next()
      } // end while
    }))
    return incomingRecords
  }

  /**
   * 通用doScan中实现，获取区块中交易信息等，用于保存到系统Block
   * @param index 高度或哈希
   */
  async getBlockResult (index: number): Promise<BlockResult | undefined> {
    const ledgerRecord = await this.getBlock(index)
    if (!ledgerRecord) return undefined

    let results = await this.sdk.transactions().forLedger(index).call()
    let txns: TxResult[] = []
    while (results && results.records.length > 0) {
      txns = txns.concat(results.records.map(record => {
        return {
          txid: record.hash,
          // 额外参数
          memo: record.memo ? record.memo.toString() : '',
          block: record.ledger,
          from: record.source_account,
          from_seq: record.source_account_sequence,
          fee: record.fee_paid
        }
      }))
      results = await results.next()
    }
    return {
      hash: ledgerRecord.hash,
      timestamp: moment.utc(ledgerRecord.closed_at).valueOf(),
      txns
    }
  }
  /**
   * 通用doScan中实现，获取地址的交易历史
   * @param address
   */
  async getTransactionHistory (address: string): Promise<TxResult[]> {
    const accountId = await this._resolveAccountId(address)
    let results = await this.sdk.transactions().forAccount(accountId).call()
    let txns: TxResult[] = []
    while (results && results.records.length > 0) {
      txns = txns.concat(results.records.map(record => {
        return {
          txid: record.hash,
          // 额外参数
          memo: record.memo ? record.memo.toString() : '',
          block: record.ledger,
          from: record.source_account,
          from_seq: record.source_account_sequence,
          fee: record.fee_paid
        }
      }))
      results = await results.next()
    }
    return txns
  }

  /**
   * 提现
   */
  async withdraw (from: string, outputs: OutInfo[], privKey: Buffer): Promise<WithdrawResult[]> {
    const fromAccount = await this._loadAccount(from)
    const hotAddress = fromAccount.accountId()
    const seqNumber = fromAccount.sequenceNumber()

    let results: WithdrawResult[] = []
    await Promise.all(outputs.map(async (output, idx) => {
      try {
        const toAccount = this._splitAddress(output.to)
        output.to = toAccount.account
        output.memo = toAccount.memo
        let result = await this._trySendTransaction(output, hotAddress, seqNumber + idx, privKey)
        if (result) {
          results.push(result as WithdrawResult)
          logger.tag('WITHDRAW', 'Sent').log(`txid=${result.txid},meta=${result.meta}`)
        }
      } catch (err) {
        logger.tag('failed-to-trySendTransaction').warn(`id=${output.id},to=${output.to},value=${output.value}`, err)
      }
    }))
    return results
  }
  /**
   * 热转冷
   * @param from
   * @param to
   * @param cap 真实金额
   */
  async sweepToCold (from: string, to: string, cap: string, privKey: Buffer): Promise<SweepToColdResult | undefined> {
    const fromAccount = await this._loadAccount(from)
    const hotAddress = fromAccount.accountId()
    const seqNumber = fromAccount.sequenceNumber()
    const output = { to, value: cap }
    try {
      const result = await this._trySendTransaction(output, hotAddress, seqNumber, privKey)
      if (result) {
        logger.tag('SWEEP', 'Sent').log(`txid=${result.txid},meta=${result.meta},cap=${cap}`)
        return Object.assign(output, result)
      }
    } catch (err) {
      logger.tag('failed-to-sweepToCold').warn(`to=${output.to},value=${output.value}`, err)
    }
    return undefined
  }
}
