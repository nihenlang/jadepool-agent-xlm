export as namespace core

export declare class BaseService {
  /**
   * @param name Service名称
   * @param lib ServiceLib
   */
  constructor (name: string, lib: ServiceLib)
  name: string
  services: ServiceLib
  /**
   * 初始化函数
   */
  initialize (opts: any): Promise<void>
}
type BaseServiceClass = BaseService

declare class ServiceLib {
  constructor ()
  /**
   * @param ServiceClass
   * @param opts 传入的初始化参数
   */
  register (ServiceClass: BaseServiceClass, opts: any): Promise<BaseService>
}
export const services: ServiceLib
