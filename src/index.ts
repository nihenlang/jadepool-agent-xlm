import _ from 'lodash'
import config from 'config'
import Logger from '@jadepool/logger'
import { jadepool, consts } from '@jadepool/lib-core'
import invokeMethod from './methods'

const logger = Logger.of('App-Stellar')

async function main () {
  await jadepool.initialize(new jadepool.Context(
    consts.SERVER_TYPES.EXTERNAL,
    process.env.npm_package_version || require('./package.json').version,
    invokeMethod,
    config
  ))

  const acceptJson = require('./acceptInterface.json')
  const acceptMethods = _.map(acceptJson, info => _.kebabCase(info.method))
  _.forEach(acceptMethods, method => logger.tag('Accept').log(method))
  await jadepool.registerService(consts.SERVICE_NAMES.JSONRPC_SERVER, {
    acceptMethods,
    host: config.get<string>('ws.host'),
    port: config.get<number>('ws.port'),
    signerId: config.get<string>('authorization.appid'),
    signer: config.get<string>('authorization.keypair.pri'),
    verifier: config.get<string>('authorization.jadepool.pub')
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
