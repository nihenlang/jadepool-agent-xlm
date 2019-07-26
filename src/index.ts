import _ from 'lodash'
import config from 'config'
import Logger from '@jadepool/logger'
import { jadepool, consts } from '@jadepool/lib-core'
import invokeMethod from './methods'

const logger = Logger.of('App-Stellar')

async function main () {
  await jadepool.initialize(new jadepool.Context(
    consts.SERVER_TYPES.EXTERNAL,
    process.env.npm_package_version || require('../package.json').version,
    invokeMethod,
    config
  ))

  const acceptMethods = [
    'ensure-connected',
    'fill-transaction',
    'filter-incoming-transactions',
    'gen-address-by-priv-key',
    'get-balance',
    'get-block-number',
    'get-block-result',
    'get-transaction-history',
    'get-order-state',
    'get-transaction-state',
    'sweep-to-cold',
    'validate-address',
    'withdraw'
  ]
  _.forEach(acceptMethods, method => logger.tag('Accept').log(method))
  await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
    acceptMethods,
    host: config.get<string>('ws.host'),
    port: config.get<number>('ws.port'),
    withoutTimestamp: true,
    // 此为使用内部签名模式
    authWithTimestamp: true
    // 以下为私钥公钥配置模式
    // signerId: config.get<string>('authorization.appid'),
    // signer: config.get<string>('authorization.keypair.pri'),
    // verifier: config.get<string>('authorization.jadepool.pub')
  })
}

process.on('warning', (warning) => {
  logger.warn(`name=${warning.name},message=${warning.message}`)
})
process.on('unhandledRejection', (reason) => {
  logger.error(null, reason, ['Unhandled Rejection'])
})
process.on('uncaughtException', (err) => {
  logger.error(null, err, ['Uncaught Exception'])
  process.exit(0)
})
if (require.main === module) {
  main()
}
