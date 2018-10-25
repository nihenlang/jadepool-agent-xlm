import WebSocket from 'ws'
import StellarSdk from 'stellar-sdk'
import NBError from '../utils/NBError'

// Types
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
}
