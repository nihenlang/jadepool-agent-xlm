import core from './core'

/**
 * Service基类
 */
class BaseService {
  protected readonly name: string
  protected readonly services: core.ServiceLib
  /**
   * @param name 服务名
   * @param services 服务库实例
   */
  constructor (name: string, services: core.ServiceLib) {
    if (services === undefined) {
      throw new Error(`[${name}] Missing Services`)
    }
    this.name = name
    this.services = services
  }
  /**
   * 初始化
   */
  async initialize (opts?: any) {
    // 需要被override实现
    throw new Error(`[${this.name}] method[initialize] need to be overrided`)
  }
  /**
   * 销毁
   */
  async onDestroy () {
    // NOTHING
  }
}

export = BaseService
