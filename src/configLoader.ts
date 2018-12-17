import _ from 'lodash'
import WebSocket from 'ws'
import { services } from './services/core'
import NBError from './utils/NBError'

export const CHAIN_KEY = 'Stellar'
export const CORE_TYPE = 'XLM'

export type ChainConfig = {
  isTestNet: boolean,
  chainIndex: number,
  endpoints: string[]
}
export type TokenConfig = {
  jadepool: {
    hotPath: string,
    hotAddress: string,
    coldAddress: string
  }
}

/**
 * 可调用瑶池的RPC为
 * 'rpc-fetch-chaincfg',
 * 'rpc-fetch-coincfg',
 * 'rpc-fetch-privkey'
 */
export async function loadChainConfig (ws: WebSocket): Promise<ChainConfig> {
  const jsonRpcSrv = services.get('jsonrpc')
  const cfgData = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-chaincfg', { chain: CHAIN_KEY })
  const chainIndex = _.get(cfgData, 'data.chainIndex')
  if (!cfgData || !cfgData.node || !chainIndex) {
    throw new NBError(500, `failed to initialize ledger`)
  }
  const nodeData: any = _.find(cfgData.node, { name: CHAIN_KEY })
  return {
    chainIndex,
    isTestNet: cfgData.isTestNet,
    endpoints: nodeData.net
  }
}

export async function loadTokenConfig (ws: WebSocket): Promise<TokenConfig> {
  const jsonRpcSrv = services.get('jsonrpc')
  const cfgData = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-coincfg', { type: CORE_TYPE })
  if (!cfgData) {
    throw new NBError(500, `failed to load config`)
  }
  return {
    jadepool: {
      hotPath: _.get(cfgData, 'jadepool.HotWallet.DerivativePath'),
      hotAddress: _.get(cfgData, 'jadepool.HotWallet.Address'),
      coldAddress: _.get(cfgData, 'jadepool.ColdWallet.Address')
    }
  }
}

/**
 * 获取私钥
 */
export async function loadPrivKey (ws: WebSocket, path: string): Promise<string> {
  const jsonRpcSrv = services.get('jsonrpc')
  const privKeyStr = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-privkey', { type: CORE_TYPE, path })
  if (!privKeyStr) {
    throw new NBError(-998, `failed to fetch privkey`)
  }
  return privKeyStr
}
