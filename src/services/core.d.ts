import WebSocket from "ws"
import JSONRPCService from './jsonrpc.service'

export as namespace core

declare namespace internal {
  class ServiceLib {
    constructor ()
    // 注册Services
    register (ServiceClass: typeof JSONRPCService, opts: { acceptMethods: string | string[] }): Promise<JSONRPCService>
    // 获取service
    get (name: 'jsonrpc'): JSONRPCService
  }
}

declare namespace core {
  type ServiceLib = internal.ServiceLib

  const services: ServiceLib
}

export = core