import _ from 'lodash'
import config from 'config'
import secp256k1 from 'secp256k1'
const createKeccakHash = require('keccak')

const DEFAULT_ENCODE = 'base64'
type SigObj = {s: string, r: string, v: number}

export namespace ecc {
  /**
   * @param obj 用于验签的消息对象
   * @param sig 签名对象
   * @param publicKey 公钥
   */
  export function verify (obj: object, sig: string | SigObj, publicKey: Buffer): boolean {
    if (!secp256k1.publicKeyVerify(publicKey)) {
      return false
    }
    // 签名字串
    let sigBuffer: Buffer
    if (typeof sig === 'string') {
      sigBuffer = Buffer.from(sig.toString(), DEFAULT_ENCODE)
    } else {
      sigBuffer = Buffer.from(Buffer.from(sig.r, DEFAULT_ENCODE).toString('hex') + Buffer.from(sig.s, DEFAULT_ENCODE).toString('hex'), 'hex')
    }
    const builtMsg = _buildMsg(obj)
    // sha3 hash
    const msgToSign: Buffer = createKeccakHash('keccak256').update(builtMsg).digest()
    // 验证签名
    return secp256k1.verify(msgToSign, sigBuffer, publicKey)
  }

  /**
   * @param str 用于验签的消息
   * @param timestamp 签名的时间戳
   * @param sig 签名对象
   * @param publicKey 公钥
   */
  export function verifyString (str: string, timestamp: number | string, sig: string | SigObj, publicKey: Buffer): boolean {
    return verify({ timestamp, str }, sig, publicKey)
  }

  /**
   * @param authString 验证字符串
   */
  export function verifyFromJadepool (authString: string): boolean {
    let [key, timestamp, sig] = authString.split(',')
    const pubKey: string = config.get('authorization.jadepool.pub') || ''
    return verifyString(key, timestamp, sig, Buffer.from(pubKey, DEFAULT_ENCODE))
  }
}

/**
 * 拼接Message的函数
 * input: obj = { k: v, z: 0, o: { arr1: [0,1], arr2: [{a: 0}, {a: 1}] } }
 * output: kvoarr101arr2a0a1z0
 */
function _buildMsg (obj: any): string {
  type KVPair = { k: string, v: string }
  let arr: KVPair[] = []
  if (_.isArray(obj)) {
    arr = obj.map((o, i) => ({ k: i.toString(), v: _buildMsg(o) }))
  } else if (_.isObject(obj)) {
    for (let k in obj) {
      if (obj[k] !== undefined) {
        arr.push({ k, v: _buildMsg(obj[k]) })
      }
    }
  } else if (obj === undefined || obj === null) {
    return ''
  } else {
    return obj.toString()
  }
  // Sort Array
  arr.sort((a: KVPair, b: KVPair) => {
    if (a.k < b.k) {
      return -1
    } else if (a.k === b.k) {
      return 0
    } else {
      return 1
    }
  })
  // Build message
  return arr.reduce((lastMsg, curr) => {
    return lastMsg + curr.k + curr.v
  }, '')
}
