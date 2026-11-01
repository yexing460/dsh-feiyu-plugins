# dsh-listen

给 DSH 上的 AI 一双耳朵。

## 做什么

用本地 `faster-whisper` 把音频或视频里的话转成带时间戳的文字。
完全离线，不联网、不上传。

支持 mp4 / mp3 / wav / m4a 等常见格式。

## 工具

`transcribe(file, model, lang, no_ts)`

- `file`：音频或视频文件的完整路径
- `model`：`tiny` / `base` / `small` / `medium` / `large-v3`，默认 `small`
- `lang`：语言，默认 `zh`；英文用 `en`；自动识别用 `auto`
- `no_ts`：不要时间戳，只给纯文本

## 依赖

- Python 3.9+
- `faster-whisper`（首次使用会自动下载模型）

```bash
pip install faster-whisper
```

## 说明

脚本随插件一起发（`scripts/听.py`）。
模型越大越准、也越慢；中文建议 `small` 起步，要求高用 `medium`。
