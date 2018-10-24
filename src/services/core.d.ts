import WebSocket from "ws";

export as namespace core

declare namespace internal {
  type BaseServiceClass = core.BaseService

  class JSONRPCService extends core.BaseService {
    requestJSONRPC (ws: WebSocket, methodName: string, args: object): Promise<any>
  }

  class ServiceLib {
    constructor ()
    /**
     * @param ServiceClass
     * @param opts 传入的初始化参数
     */
    register (ServiceClass: BaseServiceClass, opts: any): Promise<core.BaseService>
    // 获取service
    get (name: 'jsonrpc'): JSONRPCService
    get (name: string): core.BaseService
  }
}

declare namespace core {
  type ServiceLib = internal.ServiceLib

  const services: ServiceLib

  class BaseService {
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
    /**
     * 销毁函数
     */
    onDestroy (): Promise<void>
  }
}

export = core