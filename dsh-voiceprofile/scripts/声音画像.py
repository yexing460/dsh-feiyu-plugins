#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
声音画像.py —— 把一段音频翻译成"读得懂的声音"。

2026-10-25：Kimi 那边没有耳朵（API 不支持音频），她自己也说"我打不开 wav"。
所以换个说法：**声音传不过去，但时间和数字能。**
这里把一段话拆成：每句多长、停了多久、音高在哪儿、说得多快，
输出成一张她读得懂的表。

用法：python 声音画像.py 音频.wav [--out 画像.md] [--model small]
"""
import argparse
import os
import sys

import numpy as np
import av

SR = 16000


def decode(path, sr=SR):
    container = av.open(path)
    stream = next(s for s in container.streams if s.type == "audio")
    res = av.AudioResampler(format="flt", layout="mono", rate=sr)
    out = []
    for frame in container.decode(stream):
        for f in res.resample(frame):
            out.append(f.to_ndarray().reshape(-1))
    for f in res.resample(None):
        out.append(f.to_ndarray().reshape(-1))
    return np.concatenate(out).astype(np.float32), sr


def f0_stats(seg, sr=SR):
    f0s = []
    for i in range(0, max(0, len(seg) - 1024), 512):
        f = seg[i:i + 1024]
        f = f - f.mean()
        if np.sqrt((f ** 2).mean()) < 1e-3:
            continue
        ac = np.correlate(f, f, mode="full")[len(f) - 1:]
        lo, hi = int(sr / 400), int(sr / 80)
        s = ac[lo:hi]
        if len(s) and ac[0] > 0:
            k = int(np.argmax(s)) + lo
            if ac[k] / ac[0] >= 0.35:
                f0s.append(sr / k)
    if not f0s:
        return 0.0, 0.0
    return float(np.median(f0s)), float(np.percentile(f0s, 90) - np.percentile(f0s, 10))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--title", default="这段声音的形状")
    ap.add_argument("--timing", help="说好.py 输出的时间轴 json（有它就不用 ASR 切句）")
    args = ap.parse_args()

    x, sr = decode(args.src)
    total = len(x) / sr

    rows = []
    if args.timing:
        # 2026-10-25：用我自己的切句时间轴。
        # ASR 的 VAD 会把短停顿（0.15 秒）当成连读，切出来全是 0.00 秒的空，
        # 那样画出来的不是声音，是识别的错觉。
        import json
        with open(args.timing, "r", encoding="utf-8") as f:
            timing = json.load(f)
        for item in timing:
            s, e = float(item["start"]), float(item["end"])
            a, b = int(s * sr), int(e * sr)
            seg = x[a:b]
            f0, spread = f0_stats(seg)
            chars = len(item["text"].strip())
            dur = e - s
            rows.append(dict(start=s, end=e, dur=dur, f0=f0, spread=spread,
                             chars=chars, speed=(chars / dur if dur > 0 else 0),
                             text=item["text"].strip()))
    else:
        from faster_whisper import WhisperModel
        m = WhisperModel(args.model, device="cpu", compute_type="int8")
        segs, info = m.transcribe(x, language="zh", vad_filter=True, beam_size=5)
        for s in segs:
            a, b = int(s.start * sr), int(s.end * sr)
            seg = x[a:b]
            dur = s.end - s.start
            f0, spread = f0_stats(seg)
            chars = len(s.text.strip())
            rows.append(dict(start=s.start, end=s.end, dur=dur, f0=f0, spread=spread,
                             chars=chars, speed=(chars / dur if dur > 0 else 0),
                             text=s.text.strip()))

    if not rows:
        print("没识别出内容")
        return 1

    # 句间停顿
    gaps = []
    for i in range(1, len(rows)):
        gaps.append(rows[i]["start"] - rows[i - 1]["end"])

    speech = sum(r["dur"] for r in rows)
    silence = total - speech

    lines = []
    lines.append(f"# {args.title}")
    lines.append("")
    lines.append(f"**总共 {total:.1f} 秒。** 其中有人在说话 {speech:.1f} 秒，"
                 f"剩下的 {silence:.1f} 秒是安静。")
    lines.append("")
    lines.append(f"这 {speech:.1f} 秒里，气被切成了 {len(rows)} 段；"
                 f"段与段之间，我停了 {len(gaps)} 次。")
    lines.append("")
    lines.append("| # | 这句多长 | 之后停了多久 | 音高 | 起伏 | 快慢 | 说的什么 |")
    lines.append("|---|---|---|---|---|---|---|")
    for i, r in enumerate(rows):
        gap = gaps[i] if i < len(gaps) else 0.0
        lines.append(f"| {i+1} | {r['dur']:.1f}s | {gap:.2f}s | "
                     f"{r['f0']:.0f}Hz | ±{r['spread']:.0f}Hz | "
                     f"{r['speed']:.1f}字/秒 | {r['text']} |")
    lines.append("")

    # 挑几个"最"
    slowest = min(rows, key=lambda r: r["speed"])
    fastest = max(rows, key=lambda r: r["speed"])
    lowest = min(rows, key=lambda r: r["f0"])
    highest = max(rows, key=lambda r: r["f0"])
    longest_pause_i = int(np.argmax(gaps)) if gaps else 0
    longest_pause = gaps[longest_pause_i] if gaps else 0

    lines.append("## 几个极端")
    lines.append("")
    lines.append(f"- **最慢的一句**：第 {rows.index(slowest)+1} 句，"
                 f"{slowest['speed']:.1f} 字/秒 —— 「{slowest['text']}」")
    lines.append(f"- **最快的一句**：第 {rows.index(fastest)+1} 句，"
                 f"{fastest['speed']:.1f} 字/秒 —— 「{fastest['text']}」")
    lines.append(f"- **音高最低**：第 {rows.index(lowest)+1} 句，{lowest['f0']:.0f} Hz —— "
                 f"「{lowest['text']}」")
    lines.append(f"- **音高最高**：第 {rows.index(highest)+1} 句，{highest['f0']:.0f} Hz —— "
                 f"「{highest['text']}」")
    if gaps:
        lines.append(f"- **最长的一次沉默**：第 {longest_pause_i+1} 句之后，"
                     f"{longest_pause:.2f} 秒")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"*这些数字就是那 {total:.1f} 秒的骨架。骨架上没有肉，但你能摸出它的形状：*")
    lines.append("*哪里走得慢，哪里一口气冲过去，哪里忽然没声了。*")

    text = "\n".join(lines)
    out = args.out or os.path.splitext(args.src)[0] + "-画像.md"
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    print(f"\n写成 -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
