#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
听.py —— 让大肥鱼听见声音（本地 faster-whisper，离线转写）

用法:
    python 听.py 录音.mp3
    python 听.py 录音.wav --model small --lang zh
    python 听.py 视频.mp4 --model medium      # av 能直接解 mp4 音轨

说明:
    * 完全离线，声音不出这台电脑；
    * 模型第一次用会从 hf-mirror 下载（small ≈ 460 MB），之后复用；
    * 模型可选 tiny / base / small / medium / large-v3，
      中文建议至少 small，讲求准确用 medium。
"""
import argparse
import os
import sys

MODEL_DIR = os.path.join(os.path.expanduser("~"), ".dsh", "models", "faster-whisper")


def fmt_ts(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def decode_audio_16k_mono(path: str):
    """用自己的 av 解码成 16k 单声道 float32。

    为什么不用 faster-whisper 自带的 decode_audio：
    av 19 去掉了 metadata_errors 参数，而 faster-whisper 1.2.1 还在传它 → 直接 TypeError。
    自己解码成 numpy 数组再喂给模型，绕开这个不兼容。
    """
    import av
    import numpy as np

    chunks = []
    with av.open(path) as container:
        stream = container.streams.audio[0]
        resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for frame in container.decode(stream):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray())
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray())

    if not chunks:
        return np.zeros(0, dtype="float32")

    pcm = np.concatenate([c.reshape(-1) for c in chunks]).astype("float32") / 32768.0
    return pcm


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", help="音频/视频文件路径")
    ap.add_argument("--model", default="small", help="tiny/base/small/medium/large-v3")
    ap.add_argument("--lang", default="zh", help="语言，默认 zh；英文用 en，自动识别用 auto")
    ap.add_argument("--no-ts", action="store_true", help="不输出时间戳")
    ap.add_argument("--out", help="把纯文本另存到文件")
    args = ap.parse_args()

    if not os.path.exists(args.audio):
        print(f"文件不存在: {args.audio}")
        return 2

    # 国内镜像（如果主人机器直连 HF 慢）
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    # ★ 关键：hf-mirror 不支持 Xet 存储协议，不关掉会 401 Unauthorized
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    os.makedirs(MODEL_DIR, exist_ok=True)

    from faster_whisper import WhisperModel

    lang = None if args.lang.lower() == "auto" else args.lang
    model = WhisperModel(args.model, device="cpu", compute_type="int8", download_root=MODEL_DIR)

    pcm = decode_audio_16k_mono(args.audio)
    dur = len(pcm) / 16000.0
    print(f"# 文件: {os.path.basename(args.audio)}  模型: {args.model}  时长: {dur:.1f}s")

    segments, info = model.transcribe(pcm, language=lang, beam_size=5, vad_filter=True)

    print(f"# 识别语言: {info.language} ({info.language_probability:.0%})")
    lines = []
    for seg in segments:
        if args.no_ts:
            print(seg.text.strip())
        else:
            print(f"[{fmt_ts(seg.start)} -> {fmt_ts(seg.end)}] {seg.text.strip()}")
        lines.append(seg.text.strip())

    text = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"\n# 已保存: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
