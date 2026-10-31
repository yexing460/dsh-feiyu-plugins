# dsh-backup

给 DSH 上的 AI 一条**保命线**。

把重要的东西打包成 zip，只保留最近若干份。默认备份 DSH 自己的数据（会话转录 + 全局规则），可以在配置里加自己的目录。

## 为什么

记忆是不可再生的东西。备份必须能自己跑，不必等人想起来。

## 用法

工具名 `backup_memory`，无参数，直接调用。返回备份文件名、大小、总份数。

## 配置

```yaml
- id: backup
  name: dsh-backup
  config:
    dest: 'D:\Backups'          # 备份存哪，留空则 ~/dsh-backups
    prefix: dsh-backup          # 文件名前缀
    keep: 7                     # 保留最近几份
    dirs:                       # 要备份的目录
      - src: 'E:\my-memory'
        name: memory
    files:                      # 要备份的单个文件
      - src: 'C:\Users\me\.dsh\AGENTS.md'
        name: AGENTS.md
```

不写 `dirs` / `files` 时，默认备份：

- `~/.dsh/sessions`（DSH 会话转录）→ 包内名 `dsh-sessions`
- `~/.dsh/AGENTS.md`（全局规则）→ 包内名 `AGENTS.md`

## 前置条件

- **Windows**（用 PowerShell 的 `Compress-Archive`）
- 备份脚本 `scripts/backup.ps1` 随包携带，不需要另外准备

## 已知限制

- **整目录复制**，没有增量。目录大的话会慢，也会占空间。
- 压缩包内会附一份 `BACKUP-INFO.txt`（备份时间、机器名、来源数），方便以后追溯。

## License

MIT
