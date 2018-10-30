import WebSocket from 'ws'
import moment from 'moment'
import StellarSdk from 'stellar-sdk'
import NBError from '../utils/NBError'
import Logger from '../utils/logger'

const logger = Logger.of('Ledger', 'Stellar')

// Interface and Types
type ChainConfig = {
  chainIndex: number,
  endpoints: string[]
}
type TokenConfig = {
  coin: {
    Rate: number,
    FeeSelector: number,
    FeeForWithdraw: number
  },
  jadepool: {
    HotWallet: {
      DerivativePath: string,
      Address: string | ''
    },
    ColdWallet: {
      Address: string | ''
    }
  }
}
/** TxData 对象 */
interface TxData {
  type: string
  hash: string
  blockHash: string
  fee: string
  blockNumber: number
  confirmations: number
  from: Array<{address: string, value: string, txid?: string, n?: number, asset?: string}>
  to: Array<{address: string, value: string, txid?: string, n?: number, asset?: string}>
}
/**
 * 提现信息
 */
interface OutInfo {
  id: number
  to: string
  value: string
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
  state?: string
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
// Methods

// Export class
export default class Ledger {
  /**
   * 静态方法
   */
  static IS_TESTNET = process.env.NODE_ENV === 'production'
  static CHAIN_KEY = 'Stellar'
  static CORE_TYPE = 'XLM'
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
  private _chainConfig?: ChainConfig
  private _tokenConfig?: TokenConfig
  private _sdk?: StellarSdk.Server
  private _closeLedgerListener?: () => void
  private _ledgersCache: Map<number, StellarSdk.LedgerRecord> = new Map<number, StellarSdk.LedgerRecord>()
  private _latestLedgerNumber: number = -1

  // Constructor
  private constructor () {
    if (Ledger.IS_TESTNET) {
      StellarSdk.Network.useTestNetwork()
    } else {
      StellarSdk.Network.usePublicNetwork()
    }
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

  /**
   * Private Methods
   */
  private _ensureChainConfig (): ChainConfig {
    if (!this._chainConfig) {
      throw new NBError(-1, `missing chain config. ledger isn't initialized`)
    } else {
      return this._chainConfig
    }
  }
  private _ensureTokenConfig (): TokenConfig {
    if (!this._tokenConfig) {
      throw new NBError(-2, `missing token config`)
    }
    if (!this._tokenConfig.jadepool.HotWallet.Address) {
      throw new NBError(-3, `missing hot address`)
    } else {
      return this._tokenConfig
    }
  }

  private _handleIncomingLedger (ledgerRecord: StellarSdk.LedgerRecord): void {
    if (ledgerRecord.sequence > this._latestLedgerNumber) {
      this._latestLedgerNumber = ledgerRecord.sequence
    }
    this._ledgersCache.set(ledgerRecord.sequence, ledgerRecord)
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
   * 获取交易信息
   * @param txid 交易哈希
   */
  private async _getTransaction (txid: string): Promise<any> {
    return null
  }

  /**
   * 发送交易
   */
  private async _sendTransaction () {
    return null
  }

  /**
   * Public Methods
   */
  updateChainConfig (chainCfg: ChainConfig) {
    this._chainConfig = chainCfg
    this._sdk = undefined
  }
  updateTokenConfig (val: TokenConfig) {
    this._tokenConfig = val
  }
  /**
   * 获取用户地址
   * @param privKey 私钥
   * @param index 用户index
   */
  genAddress (privKey?: Buffer, index?: number): string {
    const chainCfg = this._ensureChainConfig()

    let hotAddress: string
    if (!privKey) {
      const tokenCfg = this._ensureTokenConfig()
      hotAddress = tokenCfg.jadepool.HotWallet.Address
    } else {
      if (privKey.length !== 32) {
        throw new NBError(-999, `privKey length should be 32`)
      }
      const keypair = StellarSdk.Keypair.fromRawEd25519Seed(privKey)
      hotAddress = keypair.publicKey()
    }
    // 若不存在index，则返回热主地址
    if (index === undefined) {
      return hotAddress
    } else {
      // 普通充值地址的创建
      const chainIndex = (chainCfg.chainIndex || 1) * 10000
      return hotAddress + `[${chainIndex + index}]`
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
          logger.error(null, err, ['LedgerWatcher'])
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
  async getOrderState (info: OrderInfo, bn?: number): Promise<OrderState | undefined> {
    return undefined
  }

  /**
   * 获取Transaction具体信息
   * @param info 订单情况
   * @param bn 当前区块号
   */
  async getTransactionState (info: OrderInfo, bn?: number): Promise<TxData | undefined> {
    return undefined
  }

  /**
   * 筛选出系统所需的订单
   * @param txns 从区块链获取的交易信息
   * @param bn 可选参数，这些txns所在的区块号
   * @param hasScanTask 可选参数，是否为扫描任务
   */
  async filterTransactions (txns: TxResult[], bn?: number, hasScanTask?: boolean): Promise<IncomingRecord[]> {
    const tokenCfg = this._ensureTokenConfig()
    const hotAddress = tokenCfg.jadepool.HotWallet.Address

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
      while (payments && payments.records.length > 0) {
        // 扫描记录
        payments.records.forEach((paymentRecord, i) => {
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
          // 组织Incoming对象
          incomingRecords.push({
            txid: txn.txid,
            meta: txn.meta || '',
            bn: txn.block,
            coreType: Ledger.CORE_TYPE,
            coinName: Ledger.CORE_TYPE,
            fromAddress: from,
            toAddress: to,
            value: value,
            n: i,
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
    while (results.records.length > 0) {
      txns = txns.concat(results.records.map(record => {
        return {
          txid: record.hash,
          meta: record.memo ? record.memo.toString() : '',
          // 额外参数
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
    while (results.records.length > 0) {
      txns = txns.concat(results.records.map(record => {
        return {
          txid: record.hash,
          meta: record.memo ? record.memo.toString() : '',
          // 额外参数
          block: record.ledger,
          from: record.source_account,
          from_seq: record.source_account_sequence,
          fee: record.fee_paid
        }
      }))
    }
    return txns
  }

  /**
   * 提现
   * @param coinName
   * @param outputs
   */
  async withdraw (coinName: string, outputs: OutInfo[]): Promise<WithdrawResult[]> {
    return []
  }
  /**
   * 汇总
   * @param coinName
   * @param fromAddress
   * @param cap 真实金额
   */
  async sweepToHot (coinName: string, fromAddress: string, cap: string): Promise<TxResult | undefined> {
    return undefined
  }
  /**
   * 热转冷
   * @param coinName
   * @param cap 真实金额
   */
  async sweepToCold (coinName: string, cap: string): Promise<SweepToColdResult | undefined> {
    return undefined
  }
}
