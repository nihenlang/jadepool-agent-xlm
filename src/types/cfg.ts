
export interface ChainConfig {
  isTestNet: boolean,
  chainIndex: number,
  endpoints: string[]
}

export interface WalletAddressConfig {
  address: string
  privKey?: string
}

export type AddressTypes = (0 | 1 | 2)
