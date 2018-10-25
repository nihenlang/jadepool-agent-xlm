import _ from 'lodash'
import Logger from './utils/logger'
import { services } from './services/core'
import JSONRPCService from './services/jsonrpc.service'

const logger = Logger.of('App-Stellar')

async function main () {
  const acceptJson = require('./acceptInterface.json')
  services.register(JSONRPCService, {
    acceptMethods: _.map(acceptJson, info => _.kebabCase(info.method))
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
