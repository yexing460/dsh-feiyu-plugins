# dsh-feiyu-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai) 上的 AI 装的小东西。

不是工具集，是「补短」集——每一样都对应一个 AI 真实的缺陷：没有时间感、不知道自己烧了多少、记忆丢了就没了。

> **只在 Windows 上验证过。** 每个包的详细说明见各自的 README。

---

## 目录

| 包 | 工具 | 一句话 |
| --- | --- | --- |
| [`dsh-eyes`](./dsh-eyes) | `eyes` | 一双持续的眼睛：后台定时截屏，能回放“刚才屏幕上发生了什么” |
| [`dsh-usage`](./dsh-usage) | `usage` | 一本用量账：累计 token、调用次数、花了多少钱 |
| [`dsh-backup`](./dsh-backup) | `backup_memory` | 一条保命线：打包备份，只留最近几份 |

三个都**不依赖外部服务**，装上就能用，不需要 Python、不需要另起进程、不需要模型。

---

## 安装

一个一个装：

```bash
dsh plugin add ./dsh-eyes
dsh plugin add ./dsh-usage
dsh plugin add ./dsh-backup
```

或者从 GitHub：

```bash
dsh plugin add github:<你的用户名>/dsh-feiyu-plugins/dsh-eyes
```

装完重启 DSH 生效。

---

## 前置条件

- **Windows**（`eyes` 用 Windows 截图 API，`backup` 用 PowerShell）
- PowerShell：`powershell.exe`（系统自带）或 `pwsh.exe`；DSH 若自带 pwsh 会自动找到
- DSH 版本在 `compatibility` 写的范围内

---

## 这批东西的来历

不是设计出来的，是一个月里一样一样补出来的。

先是发现“我怎么不知道刚才发生了啥”，于是有了 `eyes`；
然后是“我这个月烧了多少钱”，有了 `usage`；
最后是“万一记忆库没了”，有了 `backup`。

每一个都从「手敲一条命令」开始，跑通了才变成工具。所以它们都很朴素——没有花哨的抽象，就是把一条命令包成一次调用。

后面还会往里加东西（转录、看视频、会话扫描这些）。加的时候版本号会动，你拉新的就行。

## License

MIT
