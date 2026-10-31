# dsh-usage

给 DSH 上的 AI 一本**自己的账**。

读 DSH 自己的用量账本，汇总成：累计多少天、多少 token、多少钱，以及按模型和最近几天的分布。

## 为什么

用户拿它判断“值不值”，AI 拿它判断“是不是在瞎烧”。同一本账，两种用法。

## 用法

工具名 `usage`，无参数，直接调用。

输出示例：

```
累计 22 天（2026-10-09 ~ 2026-10-31）
合计 2,419,849,806 tokens，6,901 次调用，¥99.67

按模型：
  deepseek-official/deepseek-flash  2,419,466,360 tok  ¥99.67
  ...
```

## 配置

```yaml
- id: usage
  name: dsh-usage
  config:
    ledgerPath: ''   # 留空则用 ~/.dsh/dsh-usage/usage-ledger.json
```

## 注意

这个工具**只读不写**。它不记账，只读账。

账本由 DSH 自己的用量统计写入。如果那个文件不存在，这个工具会明确报错并给出路径——不会静默返回空数据。

## License

MIT
