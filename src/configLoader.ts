import _ from 'lodash'
import WebSocket from 'ws'
import { NBError, jadepool, consts } from '@jadepool/lib-core'
import { ChainConfig, WalletAddressConfig, AddressTypes } from './types/cfg'

export const CHAIN_KEY = 'Stellar'
export const CORE_TYPE = 'XLM'

export async function loadChainConfig (ws: WebSocket): Promise<ChainConfig> {
  const jsonRpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
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

export async function loadWalletAddress (ws: WebSocket, wallet: string, addressType: AddressTypes, withPrivKey: boolean = false): Promise<WalletAddressConfig> {
  const jsonRpcSrv = jadepool.getService(consts.SERVICE_NAMES.JSONRPC_SERVER)
  const result = await jsonRpcSrv.requestJSONRPC(ws, 'rpc-fetch-wallet-address', {
    wallet: wallet,
    addressType: addressType,
    address: undefined, // 可根据address查询
    index: 0,
    withPrivKey: !!withPrivKey
  })
  if (!result) {
    throw new NBError(500, `failed to load config`)
  }
  return result
}
