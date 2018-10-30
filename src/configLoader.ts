import _ from 'lodash'
import WebSocket from 'ws'
import { services } from './services/core'
import NBError from './utils/NBError'

export const CHAIN_KEY = 'Stellar'
export const CORE_TYPE = 'XLM'
export const IS_TESTNET = process.env.NODE_ENV === 'production'

export type ChainConfig = {
  chainIndex: number,
  endpoints: string[]
}
export type TokenConfig = {
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

export async function loadChainConfig (ws: WebSocket): Promise<ChainConfig> {
  const jsonRpcSrv = services.get('jsonrpc')
  const cfgData = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-chaincfg', { chain: CHAIN_KEY })
  if (!cfgData || !cfgData.node || cfgData.ChainIndex === undefined) {
    throw new NBError(500, `failed to initialize ledger`)
  }
  const nodeData: any = _.find(cfgData.node, { name: CHAIN_KEY })
  return {
    chainIndex: cfgData.ChainIndex,
    endpoints: process.env.NODE_ENV === 'production' ? nodeData.TestNet : nodeData.MainNet
  }
}

export async function loadTokenConfig (ws: WebSocket): Promise<TokenConfig> {
  const jsonRpcSrv = services.get('jsonrpc')
  const cfgData = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-coincfg', { type: CORE_TYPE })
  // TODO
  return null
}
