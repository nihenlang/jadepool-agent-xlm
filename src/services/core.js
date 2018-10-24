const _ = require('lodash')

const Logger = require('../utils/logger')
const logger = Logger.of('Service')

const serivcesKey = Symbol('servicesKey')
/**
 * 服务库实例
 */
class ServiceLib {
  constructor () {
    this[serivcesKey] = new Map()
  }
  /**
   * @param {Class<BaseService>} ServiceClass
   * @param {Object} opts 传入的初始化参数
   * @returns {BaseService}
   */
  async register (ServiceClass, opts) {
    const serv = new ServiceClass(this)
    this[serivcesKey].set(serv.name, serv)
    // 设置参数
    Object.defineProperty(this, serv.name, {
      enumerable: true,
      get: () => {
        return this[serivcesKey].get(serv.name)
      }
    })
    // 执行初始化
    await serv.initialize(opts || {})
    logger.tag('Attached').log(`name=${serv.name}`)
    // 设置registerTime
    lastRegisterTime = Date.now()
    return serv
  }

  /**
   * @param {String} name
   * @returns {<BaseService>}
   */
  get (name) {
    if (this[serivcesKey].has(name)) {
      return this[serivcesKey].get(name)
    } else {
      return null
    }
  }
}
const services = new ServiceLib()
let isGracefulExiting = false
let lastRegisterTime = Date.now()
/**
 * 统一Process处理函数
 */
const graceful = (SigStr) => {
  return async () => {
    if (isGracefulExiting) return
    isGracefulExiting = true
    // 新注册等待后方可自动退出
    const ts = 1000
    if (Date.now() - lastRegisterTime < ts) {
      await new Promise(resolve => setTimeout(resolve, ts))
    }
    try {
      logger.diff('Services Exit').log(`Begin`)
      await Promise.all(_.map(services, async ins => {
        if (typeof ins.onDestroy === 'function') {
          await ins.onDestroy()
        }
        logger.tag('Detached').log(`name=${ins.name}`)
      }))
      logger.diff('Services Exit').log(`End`)
    } catch (err) {
      logger.tag('Services Exit').error('failed to graceful exit', err)
    }
    await Logger.exit()
    process.kill(process.pid, SigStr)
  }
}
// 注册process的优雅退出处理函数
process.once('SIGUSR2', graceful('SIGUSR2'))
process.once('SIGQUIT', graceful('SIGQUIT'))
process.once('SIGTERM', graceful('SIGTERM'))
process.once('SIGINT', graceful('SIGINT'))

module.exports = {
  services // Services Singleton实例
}
