export as namespace Logger

declare class Logger {
  constructor (category: string, sub: string)
  /**
   * 链式调用，记录下个日志的标签
   * @param tags
   */
  tag (...tags: string[]): Logger
  /**
   * 根据flag对两段同flag的log进行diff deltatime
   * @param flag
   */
  diff (flag: string): Logger
  // 功能性日志记录
  // ----------------- Error型 --------------------
  /**
   * 错误日志
   * @param message info记录
   * @param err 错误对象
   * @param tags 各类日志标签
   */
  error (message: string | null | undefined, err: Error | undefined, tags?: string[]): void
  // ------------------- Log型 ----------------------
  /**
   * 警报日志
   * @param message info记录
   * @param tags 各类日志标签
   */
  warn (message: string, ...args: string[]): void
  /**
   * 普通日志，但须有所注意
   * @param message info记录
   * @param tags 各类日志标签
   */
  notice (message: string, ...args: string[]): void
  /**
   * 普通日志，常用方法，使用NOTICE级别
   * @param message info记录
   * @param tags 各类日志标签
   */
  log (message: string, ...args: string[]): void
  /**
   * 普通日志，带'INFO' tag
   * @param message info记录
   * @param tags 各类日志标签
   */
  info (message: string, ...args: string[]): void
  /**
   * 调试日志
   * @param message info记录
   * @param tags 各类日志标签
   */
  debug (message: string, ...args: string[]): void
  /**
   * 平铺记录对象，使用log方法
   * @param msgObj 日志对象
   * @param tags
   */
  logObj (msgObj: object, tags?: string[]): void
}

export function setLoggerLevel (): void
export function exit (): Promise<void>
/**
 * 获取标准化日志
 * @param category 主类别
 * @param sub 子类别
 */
export function of (name: string, sub?: string): Logger
