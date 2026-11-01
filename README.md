# dsh-feiyu-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai) 上的 AI 装的小东西。

这不是工具集，而是「补短」集：每一样都对应一个 AI 真实的缺陷。

> **只在 Windows 上验证过。** 每个包的详细说明见各自的 README。

---

## 目录

### 一档 · 不需要 Python

| 包 | 工具 | 一句话 |
| --- | --- | --- |
| [`dsh-eyes`](./dsh-eyes) | `eyes` | 一双持续的眼睛：后台定时截屏，能回放「刚才屏幕上发生了什么」 |
| [`dsh-usage`](./dsh-usage) | `usage` | 一本用量账：累计 token、调用次数、花了多少钱 |
| [`dsh-backup`](./dsh-backup) | `backup_memory` | 一条保命线：打包备份，只留最近几份 |

### 二档 · 需要 Python

| 包 | 工具 | 一句话 |
| --- | --- | --- |
| [`dsh-watch`](./dsh-watch) | `watch_video` | 看视频：下载 → 抽帧 → 字幕条拼成带时间戳的图 |
| [`dsh-listen`](./dsh-listen) | `transcribe` | 听声音：本地 `faster-whisper` 离线转写，不联网 |
| [`dsh-sessions`](./dsh-sessions) | `scan_sessions` | 翻自己的会话：查哪些聊过但没写进日记 |
| [`dsh-room`](./dsh-room) | `room_picture` | 把一间屋子画成一张图 |
| [`dsh-voiceprofile`](./dsh-voiceprofile) | `voice_profile` | 给一段声音做画像：每句多长、停多久、音高、语速 |

---

## 装

### 一、在 DSH 里装（推荐）

打开 DSH → 插件 → 添加插件，在输入框里填**这一行**（**不要**加 `npm install`）：

```
github:yexing460/dsh-feiyu-plugins
```

或者填完整地址：

```
https://github.com/yexing460/dsh-feiyu-plugins
```

> ⚠️ 输入框只认包标识，填 `npm install github:...` 会报
> 「无法识别这个包名或地址」，这是常见的坑。

### 二、或者手动写依赖

在 `~/.dsh/profiles/<profile>/package.json` 的依赖里加：

```json
"dsh-feiyu-plugins": "github:yexing460/dsh-feiyu-plugins"
```

然后在该目录跑 `npm install`（或 `pnpm install`）。

### 三、或者命令行

```bash
npm install github:yexing460/dsh-feiyu-plugins
```

重启 DSH 即可。八个工具会一起出现。

### 只想要一部分？

每个子包都能单独拷到 `node_modules` 下用——它们之间没有相互依赖，
`lib/index.js` 里每一段 `apply` 都是独立可摘的。

---

## 二档的依赖

一档是纯 JS，装上就能用。

二档靠 Python 脚本跑活，需要自己装：

```bash
pip install yt-dlp av Pillow faster-whisper
```

| 包 | 需要的库 |
| --- | --- |
| dsh-watch | `yt-dlp`、`av`、`Pillow` |
| dsh-listen | `faster-whisper`（首次使用会自动下模型） |
| dsh-sessions | 无（纯标准库） |
| dsh-room | `Pillow` |
| dsh-voiceprofile | `numpy`、`Pillow` |

Python 解释器默认取 PATH 里的 `python`。
想指定绝对路径，设环境变量：

```bash
DSH_PYTHON=C:\Python311\python.exe
```

---

## 配置

全部可选，写在 `cordis.patch.yml` 的 `config` 里：

```yaml
- insert:
    - id: feiyu-plugins
      name: dsh-feiyu-plugins
      config:
        eyesInterval: 2     # 每隔几秒截一张
        eyesKeep: 60        # 只保留最近几张
        backupKeep: 7       # 备份留几份
```

---

## 为什么是这些

每一样都对应一个具体的缺陷，不是「别人有所以我也要有」：

- **看不见屏幕** → `eyes`
- **不知道自己烧了多少钱** → `usage`
- **记忆丢了就没了** → `backup_memory`
- **看不见视频里的人做了什么** → `watch_video`
- **听不见声音** → `transcribe`
- **不知道自己聊过什么、忘了写** → `scan_sessions`
- **说不出一间屋子长什么样** → `room_picture`
- **分不清「像人说话」和「像朗读」** → `voice_profile`

---

MIT
