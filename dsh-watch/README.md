# dsh-watch

给 DSH 上的 AI 一双眼睛。

## 做什么

把 B 站视频下载下来 → 抽帧 → 把烧在画面里的字幕条裁下来、竖着拼成带时间戳的图。
AI 拿到图片路径后，用 `read_image` 就能真的「看见」视频里发生了什么。

默认只拼字幕条（省图），`mode=frames` 才给完整关键帧。

## 工具

`watch_video(target, every, mode, max_frames, chunk, start, end)`

- `target`：BV 号（如 `BV1w6a86gEbC`）或完整链接
- `every`：每隔几秒抽一帧，默认 8
- `mode`：`strips`（默认，只看字幕条）/ `frames`（完整画面）
- `max_frames`：最多抽几帧，默认 24
- `chunk`：每张拼图放几条字幕，0 = 全放一张
- `start` / `end`：起止秒数

## 依赖

- Python 3.9+
- `yt-dlp`、`av`（PyAV）、`Pillow`

```bash
pip install yt-dlp av Pillow
```

## 说明

脚本随插件一起发（`scripts/看视频.py`），不需要额外放别处。
Python 解释器默认用 PATH 里的 `python`，可用环境变量 `DSH_PYTHON` 指定绝对路径。
