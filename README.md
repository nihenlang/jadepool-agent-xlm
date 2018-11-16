# JadePool-Agent-XLM

瑶池XLM业务处理终端

## 安装使用

``` lang=shell
// 安装依赖
npm install

// 开发运行(dev模式)
npm run dev

// 编译ts
npm run build

// 编译后运行
npm run serve
```

## 通信协议

本服务的实现使用基于WebSocket的JSONRPC 2.0规范，具体参见：
[JSONRPC2.0协议规范](https://www.jsonrpc.org/specification)
接收的参数params本服务使用命名参数规则，此外不再做过多赘述。

## 验证协议

### 配置公私钥对

需在本服务中记录配置

1. 瑶池ECC公钥
2. 本服务ECC私钥

需在瑶池配置中添加（Admin界面上）

1. 本服务appid
2. 本服务ECC公钥

### 瑶池 -> 本服务

瑶池通过ws连接时会进行认证, 瑶池会在请求中附带验证字符串`req.headers.authorization`。该字段将拆分为key, timestamp, sig，使用瑶池公钥可验证来源信息为瑶池。
验证算法参考：`utils/crypto.ts`

### 本服务 -> 瑶池

当需要向瑶池请求信息时，除标准JSONRPC协议外，还需额外添加一个字段`sig`，其内容为:

``` lang=javascript
let sig = {
  appid: '{本服务的配置在瑶池中的appid}',
  signature: '{请求体的哈希签名}'
}
```

以此来证明该RPC请求来源为被授权的应用。

## API说明

建议参考的配置文档：

1. 模版配置： `src/acceptInterface.template.json`
2. 本应用配置： `src/acceptInterface.json`

### 必须实现的主要方法

- **genAddress** 生成充值地址，请求参数：
  - path (可选)衍生路径
  - index 地址序号
- **validateAddress** 验证地址，请求参数：
  - address 被查地址
- **getBlockNumber** 获取最新区块号，请求参数: 无
- **getBalance** 获取地址/钱包余额，请求参数：
  - address 被查地址(若UTXO类可返回钱包余额)
  - coinName 币种别名
- **getBlock** 获取Block基础信息(瑶池用于检查区块是否存在)，请求参数：
  - indexOrHash 区块号(or区块哈希，通常不用)
- **getBlockResult** 获取Block下的全部txns，请求参数：
  - indexOrHash 区块号(or区块哈希，通常不用)
- **getTransactionHistory** 获取地址内的全部txns，请求参数：
  - address 被查地址
- **filterTransactions** 根据交易返回筛选结果，请求参数：
  - txns 由getBlockResult/getTransactionHistory返回的原始数据
  - bn (可选)这些交易所在的区块号
- **withdraw** 发起提现请求，请求参数：
  - coinName 币种别名
  - outputs: { id, to, value }[] 请求信息
- **sweepToCold** 发起热转冷请求，请求参数：
  - coinName 币种别名
  - cap 金额
- **getOrderState** 查询并修改订单状态，请求参数：
  - info { txid, meta, coinName, block }, 订单信息
  - bn 目前的最新区块号，不用再次获取
- **getTransactionState** 查询指定txid的交易信息，请求参数：
  - info { txid, meta, coinName, block }, 订单信息
  - bn 目前的最新区块号，不用再次获取

### 可选实现的方法（若不实现则使用默认函数）

- **ensureConnected** 检查节点是否连接，请求参数: 无
- **sweepToHot** 发起汇总请求，请求参数:
  - coinName 币种别名
  - fromAddress 来源地址
  - cap 金额

### 可选实现的Hook方法（在定时任务中会调用）

- **initializePostHook** 系统初始化完成后被调用
- **createAddressPostHook** 创建充值地址后被调用，该hook的默认方法为设置新地址为used状态
- **txAndSweepPreHook** 出金逻辑（提现等）定时任务启动前
- **txAndSweepPostHook** 出金逻辑（提现等）定时任务启动后
- **closerPreHook** 入金扫描（充值等）定时任务启动前
- **closerPostHook** 入金扫描（充值等）定时任务启动后