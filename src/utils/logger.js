const fs = require('fs')
const path = require('path')
const tty = require('tty')
const cluster = require('cluster')
const _ = require('lodash')
const moment = require('moment')

const loggers = new Map()
// 根据process.env生成opts
/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ LOGGER_COLORS=no LOGGER_LEVEL=DEBUG node script.js
 */
const inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^logger_/i.test(key)
}).reduce(function (obj, key) {
  // camel-case
  var prop = _.camelCase(key.substring(7))

  // coerce string value into JS value
  var val = process.env[key]
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false
  else if (val === 'null') val = null
  else if (!isNaN(parseInt(val))) val = parseInt(val)

  obj[prop] = val
  return obj
}, {})

// 加载config配置
try {
  const config = require('config')
  Object.keys(config).filter(key => {
    return /^log/i.test(key)
  }).forEach((key) => {
    // camel-case
    var prop = _.camelCase(key.substring(3))
    inspectOpts[prop] = inspectOpts[prop] || config[key]
  })
} catch (err) {
  // swallow - we only care if `config` is available; it doesn't have to be.
}

//  ------ 级别 ------
const Levels = {
  NO_LOG: -1, // 无日志
  FATAL: 0, // 致命报错
  ERROR: 1, // 错误日志
  WARN: 2, // 警报日志
  NOTICE: 3, // 普通日志，但须有所注意
  INFO: 4, // 普通日志
  DEBUG: 5 // 调试日志
}

/**
 * @returns {Number}
 */
function getLoggerLevel () {
  return Levels[inspectOpts.level || 'DEBUG'] || Levels.DEBUG
}
function setLoggerLevel (val) {
  inspectOpts['level'] = val
}

//  ------ 颜色 ------
let colors = [ 6, 2, 3, 4, 5, 1 ]
try {
  var supportsColor = require('supports-color').stdout
  if (supportsColor && supportsColor.level >= 2) {
    colors = [
      20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68,
      69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128, 129, 134,
      135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171,
      172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201, 202, 203, 204,
      205, 206, 207, 208, 209, 214, 215, 220, 221
    ]
  }
} catch (err) {
  // swallow - we only care if `supports-color` is available; it doesn't have to be.
}

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 * @returns {Boolean}
 */
function useColors () {
  return 'colors' in inspectOpts
    ? Boolean(inspectOpts.colors)
    : tty.isatty(process.stderr.fd)
}

function hash2Num (namespace) {
  let hash = 0
  for (let i in namespace) {
    hash = ((hash << 5) - hash) + namespace.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */
function selectColor (namespace) {
  return colors[hash2Num(namespace) % colors.length]
}

const logModules = []

class BaseModule {
  constructor (opts) {
    this._opts = opts
  }
  async onDestroy () {
    // NOTHING
  }
  log (msg) { throw new Error('need implement') }
  error (msg) { throw new Error('need implement') }
}
class FileModule extends BaseModule {
  constructor (opts) {
    super(opts)
    if (!opts.dir) {
      throw new Error()
    }
    const dirName = opts.dir
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName)
    }

    const processName = opts.name ? `-${opts.name}` : ''
    const fileNameOut = `${dirName}/${process.env.NODE_ENV}-out${processName}.log`
    const fileNameErr = `${dirName}/${process.env.NODE_ENV}-err${processName}.log`
    const fdOut = fs.openSync(fileNameOut, 'a+')
    const fdErr = fs.openSync(fileNameErr, 'a+')
    this._outStream = fs.createWriteStream(fileNameOut, { flags: 'a', fd: fdOut })
    this._errStream = fs.createWriteStream(fileNameErr, { flags: 'a', fd: fdErr })
  }
  async onDestroy () {
    await new Promise(resolve => { this._outStream.end(resolve) })
    await new Promise(resolve => { this._errStream.end(resolve) })
  }
  log (msg) { this._outStream.write(msg + '\n') }
  error (msg) { this._errStream.write(msg + '\n') }
}

// 通用私有方法
/**
 * @private
 */
function _error (message, err, tags) {
  if (!tags) {
    if (message instanceof Error) {
      err = message
      tags = err || []
      message = null
    } else {
      tags = []
    }
  }
  if (!(err instanceof Error)) {
    err = err ? new Error(err.message || err) : new Error()
  }
  let errStr = `message=${err.message},name=${err.name}`
  if (process.env.NODE_ENV !== 'production') {
    errStr += `,stack=${err.stack}}`
  }
  if (message !== '' && message !== null) {
    errStr = `info=${message},${errStr}`
  }
  // Response Error特殊处理
  if (err.response) {
    const resError = err.response
    const resData = typeof resError.data === 'string' ? resError.data : JSON.stringify(resError.data || {})
    errStr = `res=[${resError.status}|${resError.statusText}|${resData}],${errStr}`
  }
  // 构建message
  const msg = _formatRecord.call(this, errStr, tags)
  console.error(msg)
  logModules.forEach(mod => mod.error(msg))
  return this
}

/**
 * @param {String} message 日志记录
 * @param {String[]} tags 各类日志标签
 * @private
 */
function _log (message, tags) {
  const msg = _formatRecord.call(this, message || 'EMPTY', tags)
  console.log(msg)
  logModules.forEach(mod => mod.log(msg))
  return this
}

/**
 * 标准化输出
 * @returns {String}
 */
function _formatRecord (message, tags) {
  const datestr = getDate()
  const tagstr = _buildTags.call(this, tags)
  const diffstr = _buildDiff.call(this)
  // 构建日志
  let prefix = datestr + '|' + tagstr + '|'
  message = prefix + message.split('\n').join('\n' + prefix)
  return message + (diffstr || '')
}

/**
 * 获取日期时间
 */
function getDate () {
  return inspectOpts.hideDate ? '' : new Date().toLocaleString()
}

/**
 * 生成Log Tags
 * @param {String[]} tags 各类日志标签
 * @returns {String}
 * @private
 */
function _buildTags (tags) {
  if (this._nextTags) {
    tags.unshift(...this._nextTags)
    this._nextTags = null
  }
  if (this._nextFlag) {
    tags.unshift(this._nextFlag)
  }
  // 添加主类型
  let categoryTag = !this._sub ? this._category : `${this._category} - ${this._sub}`
  tags.unshift(categoryTag)
  // 添加WorkerTag
  if (cluster.isWorker) {
    tags.unshift(`<${cluster.worker.id}>`)
  }
  // 构建tags
  tags = (tags || []).map(t => `[${t}]`)

  const tagstr = tags.join('')
  const c = this._color
  return this._useColors
    ? `\u001b[3${c < 8 ? c : '8;5;' + c};1m${tagstr}\u001b[0m`
    : tagstr
}

/**
 * 生成Log Diff
 * @returns {String}
 * @private
 */
function _buildDiff () {
  const flag = this._nextFlag
  if (flag === undefined || flag === null) return undefined
  // 记录Flag时间
  let curr = moment.now()
  const prevTime = this._flags[flag] || curr
  this._flags[flag] = curr
  this._nextFlag = undefined

  const hashStr = (hash2Num(_.kebabCase(flag)) + '').substr(0, 6)
  const diffstr = `<${hashStr}>+${moment.utc(curr - prevTime).format('m:s.SSS')}`
  const c = this._color
  return this._useColors
    ? `|\u001b[3${c < 8 ? c : '8;5;' + c}m${diffstr}\u001b[0m`
    : `|${diffstr}`
}

class Logger {
  /**
   * 标准化日志
   * @param {String} category 主类别
   * @param {String} sub 子类别
   */
  constructor (category, sub) {
    this['_category'] = category || 'Default'
    this['_sub'] = sub || ''
    this['_color'] = selectColor(this._category + sub)
    this['_useColors'] = useColors()
    this['_flags'] = {}
  }
  // 链式调用辅助功能
  /**
   * 添加之后第一个log中的标签
   * @param  {...String} tags
   */
  tag (...tags) {
    this['_nextTags'] = tags
    return this
  }
  /**
   * 根据flag对两段同flag的log进行diff deltatime
   * @param {String} flag
   */
  diff (flag = 'default') {
    this['_nextFlag'] = flag
    return this
  }
  // 功能性日志记录
  // ----------------- Error型 --------------------
  /**
   * 错误日志
   * @param {String} message info记录
   * @param {Error} err 错误对象
   * @param {String[]} tags 各类日志标签
   */
  error (message, err, tags) {
    if (getLoggerLevel() < Levels.ERROR) return this
    return _error.call(this, message, err, tags)
  }
  // ------------------- Log型 ----------------------
  /**
   * 警报日志
   * @param {String} message info记录
   * @param {String[]} tags 各类日志标签
   */
  warn (message, ...args) {
    if (getLoggerLevel() < Levels.WARN) return this
    const tags = _.isArray(args[args.length - 1]) ? args.pop() : []
    tags.unshift('WARN')
    args.unshift(message)
    return _log.call(this, args.join(','), tags)
  }
  /**
   * 普通日志，但须有所注意
   * @param {String} message info记录
   * @param {String[]} tags 各类日志标签
   */
  notice (message, ...args) {
    if (getLoggerLevel() < Levels.NOTICE) return this
    const tags = _.isArray(args[args.length - 1]) ? args.pop() : []
    tags.unshift('NOTICE')
    args.unshift(message)
    return _log.call(this, args.join(','), tags)
  }
  /**
   * 普通日志，常用方法，使用NOTICE级别
   * @param {String} message info记录
   * @param {String[]} tags 各类日志标签
   */
  log (message, ...args) {
    if (getLoggerLevel() < Levels.NOTICE) return this
    const tags = _.isArray(args[args.length - 1]) ? args.pop() : []
    args.unshift(message)
    return _log.call(this, args.join(','), tags)
  }
  /**
   * 普通日志，带'INFO' tag
   * @param {String} message info记录
   * @param {String[]} tags 各类日志标签
   */
  info (message, ...args) {
    if (getLoggerLevel() < Levels.INFO) return this
    const tags = _.isArray(args[args.length - 1]) ? args.pop() : []
    tags.unshift('INFO')
    args.unshift(message)
    return _log.call(this, args.join(','), tags)
  }
  /**
   * 调试日志
   * @param {String} message info记录
   * @param {String[]} tags 各类日志标签
   */
  debug (message, ...args) {
    if (getLoggerLevel() < Levels.DEBUG) return this
    const tags = _.isArray(args[args.length - 1]) ? args.pop() : []
    tags.unshift('DEBUG')
    args.unshift(message)
    return _log.call(this, args.join(','), tags)
  }
  /**
   * 平铺记录对象，使用log方法
   * @param {Object} msgObj 日志对象
   * @param {String[]} tags
   */
  logObj (msgObj, tags) {
    let args = []
    for (const k in msgObj) {
      if (msgObj.hasOwnProperty(k)) {
        args.push(`${k}=${msgObj[k]}`)
      }
    }
    if (tags) args.push(tags)
    return this.log(...args)
  }
}

// --- 防止内存溢出 ----
const getPurgeInterval = () => {
  return inspectOpts['purgeInterval'] || 1000 * 60 * 10 // 默认10分钟一次
}
const purgeFlags = () => {
  const deadtime = moment.now() - getPurgeInterval()
  let counter = 0
  loggers.forEach(logger => {
    for (let key in logger._flags) {
      if (logger._flags[key] > deadtime) continue
      delete logger._flags[key]
      counter++
    }
  })
  console.log(`Logger purged|counter=${counter}`)
}
let intervalId

/**
 * 执行一次初始化
 */
(function () {
  // 根据环境变量进行Logger的模块初始化
  _.forEach(inspectOpts['modules'], moduleCfg => {
    let moduleName
    let moduleOpts
    if (_.isArray(moduleCfg)) {
      moduleName = moduleCfg[0]
      moduleOpts = moduleCfg[1] || {}
    } else if (_.isString(moduleCfg)) {
      moduleName = moduleCfg
    } else {
      return
    }
    switch (moduleName) {
      case 'file':
        logModules.push(new FileModule({
          dir: path.resolve(__dirname, '../..', moduleOpts.dirpath || 'logs'),
          name: moduleOpts.name || 'default'
        }))
        break
      default:
        return
    }
    console.log(`Logger Module[${moduleName}] installed`)
  })
  // 根据环境变量设置Purge周期
  intervalId = setInterval(purgeFlags, getPurgeInterval())
})()

/**
 * 退出函数
 */
async function exit () {
  if (intervalId) clearInterval(intervalId)
  loggers.clear()
  return Promise.all(logModules.map(mod => { return mod.onDestroy() }))
}

module.exports = Object.assign(Logger, {
  // Methods
  setLoggerLevel,
  exit,
  /**
   * 返回Logger
   * @param {String} name 主名称
   * @param {String} sub 子名称
   * @returns {Logger}
   */
  of (name, sub) {
    let key = name + (sub || '')
    let logger = loggers.get(key)
    if (!logger) {
      logger = new Logger(name, sub)
      loggers.set(key, logger)
    }
    return logger
  }
})
