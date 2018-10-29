import WebSocket from 'ws'
import StellarSdk, { Account } from 'stellar-sdk'
import NBError from '../utils/NBError'

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
      Address?: string
    },
    ColdWallet: {
      Address?: string
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
}
interface OrderInfo extends TxResult {
  coinName: string
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
  private _sdk?: StellarSdk.Server
  private _chainConfig?: ChainConfig
  private _tokenConfig?: TokenConfig

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
  set chainConfig (val: ChainConfig) {
    this._chainConfig = val
    this._sdk = undefined
  }
  set tokenConfig (val: TokenConfig) { this._tokenConfig = val }

  get isInitialized () { return !!this._chainConfig }
  get sdk (): StellarSdk.Server {
    if (!this._sdk) {
      this._sdk = new StellarSdk.Server(this.chainConfig.endpoints[0])
    }
    return this._sdk
  }

  /**
   * Methods
   */
  /**
   * 获取用户地址
   * @param privKey 私钥
   * @param index 用户index
   */
  genAddress (privKey?: Buffer, index?: number): string {
    if (!this._chainConfig) {
      throw new NBError(-1, `missing chain config. ledger isn't initialized`)
    }
    let hotAddress: string
    if (!privKey) {
      if (!this._tokenConfig) {
        throw new NBError(-2, `missing token config`)
      }
      if (!this._tokenConfig.jadepool.HotWallet.Address) {
        throw new NBError(-3, `missing hot address`)
      }
      hotAddress = this._tokenConfig.jadepool.HotWallet.Address
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
      const chainIndex = (this._chainConfig.chainIndex || 1) * 10000
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
    return 0
  }

  /**
   * 获取地址余额, 此处是除以Decimals Rate的显示值
   * @param address 查询地址
   * @param coinName 币种名称
   */
  async getBalance (address: string, coinName?: string): Promise<string> {
    return ''
  }

  /**
   * 获取区块信息
   * @param indexOrHash 区块高度
   */
  async getBlock (index: number): Promise<any> {
    return null
  }

  /**
   * 获取交易信息
   * @param txid 交易哈希
   */
  async getTransaction (txid: string): Promise<any> {
    return null
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
  async filterTransactions (txns: TxResult[] | string[], bn?: number, hasScanTask?: boolean): Promise<IncomingRecord[]> {
    return []
  }

  // ---------- Default Task 必选实现 ----------
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
  /**
   * 通用doScan中实现，获取区块中交易信息等，用于保存到系统Block
   * @param indexOrHash 高度或哈希
   */
  async getBlockResult (indexOrHash: number | string): Promise<BlockResult | undefined> {
    return undefined
  }
  /**
   * 通用doScan中实现，获取地址的交易历史
   * @param address
   */
  async getTransactionHistory (address: string): Promise<TxResult[]> {
    return []
  }
}
