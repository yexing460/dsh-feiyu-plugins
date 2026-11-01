#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
看视频.py —— 把 B 站视频变成"我能读的东西"（硬字幕 + 关键帧）

思路（为什么这么设计）：
    很多二创视频把字幕烧在画面里。与其让 ASR 去猜，不如**直接把字幕条裁出来看**。
    逐帧看图太贵，所以默认把每一帧的"底部字幕条"裁下来，竖着拼成一张长图 ——
    20 个时间点的字幕，只消耗 1 张图。

用法：
    python 看视频.py BV1w6a86gEbC
    python 看视频.py https://www.bilibili.com/video/BV1w6a86gEbC/ --every 6
    python 看视频.py BV1w6a86gEbC --mode frames     # 要完整画面（看表情/场景）
    python 看视频.py BV1w6a86gEbC --sub-band 0.62 0.94   # 调字幕条区域（看实际位置）

产物（默认在 %TEMP%/fy-watch/<id>/）：
    strips.jpg   字幕条拼图（一张，带时间戳）★ 默认
    frames/*.jpg 完整关键帧
    meta.json    时间点与文件对应关系

依赖：yt-dlp、av、Pillow（已装）
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

TEMP = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"


def norm_url(s: str) -> str:
    s = s.strip()
    if re.fullmatch(r"BV[0-9A-Za-z]{10}", s):
        return f"https://www.bilibili.com/video/{s}/"
    if s.startswith("http"):
        return s
    raise SystemExit(f"看不懂这个: {s}")


def vid_id(url: str) -> str:
    m = re.search(r"(BV[0-9A-Za-z]{10})", url)
    if m:
        return m.group(1)
    return "video"


def download_audio(url: str, outdir: str) -> str:
    """单独下一条音频轨（给"听"用）。视频轨不含声音，所以这里要单独取。"""
    target = os.path.join(outdir, "audio.m4a")
    if os.path.exists(target) and os.path.getsize(target) > 1024 * 20:
        print("# 复用已下载的音频")
        return target

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-playlist", "--no-warnings",
        "-f", "bestaudio/best",
        "-o", target,
        url,
    ]
    print("# 下载音频 ...")
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if not os.path.exists(target):
        print("# 音频下载失败（可能这个视频没有音轨）: " + r.stdout[-400:])
        return ""
    return target


def download_video(url: str, outdir: str) -> str:
    """下载 480p 视频轨（不合并音频，避免依赖 ffmpeg）"""
    target = os.path.join(outdir, "vid.mp4")
    if os.path.exists(target) and os.path.getsize(target) > 1024 * 100:
        print("# 复用已下载的视频")
        return target

    fmt = "30032/100023/30033/30016/100022/best"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-playlist", "--no-warnings",
        "-f", fmt,
        "-o", target,
        url,
    ]
    print("# 下载视频 ...")
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 or not os.path.exists(target):
        # 有些视频没有 30032，让 yt-dlp 自己挑一个纯视频轨
        cmd[cmd.index(fmt)] = "bestvideo/best"
        r2 = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if not os.path.exists(target):
            print(r.stdout[-800:] + "\n" + r2.stdout[-800:])
            raise SystemExit("下载失败")
    return target


def probe_duration(path: str) -> float:
    import av
    with av.open(path) as c:
        return float(c.duration) / 1_000_000.0 if c.duration else 0.0


def grab(path: str, times, sub_band, mode, outdir, scale=1.0, only_sub=False, chunk=0):
    import av
    from PIL import Image, ImageDraw

    frames_dir = os.path.join(outdir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    times = sorted(times)
    want = list(times)
    picked = []          # (sec, PIL.Image)
    with av.open(path) as c:
        vs = c.streams.video[0]
        tb = float(vs.time_base)
        for frame in c.decode(vs):
            t = float(frame.pts * tb) if frame.pts is not None else 0.0
            while want and t >= want[0] - 0.05:
                sec = want.pop(0)
                img = frame.to_image().convert("RGB")
                picked.append((sec, img))
                img.save(os.path.join(frames_dir, f"f{int(sec):04d}.jpg"), quality=82)
            if not want:
                break

    if not picked:
        raise SystemExit("没抽到帧")

    if mode == "frames":
        # ★ 2026-11-01 修：原来只返回 dir，插件端只认 files 列表 → frames 模式恒报「没产出图」。
        files = [os.path.join(frames_dir, f"f{int(sec):04d}.jpg") for sec, _ in picked]
        return {"mode": "frames", "count": len(picked),
                "dir": frames_dir, "files": files,
                "times": [t for t, _ in picked]}

    # ---- 字幕条拼图 ----
    strips = []
    for sec, img in picked:
        w, h = img.size
        top = int(h * sub_band[0])
        bot = int(h * sub_band[1])
        band = img.crop((0, top, w, bot))

        if only_sub:
            # 粗略判断"这条里有没有字"：转灰后看边缘强度
            from PIL import ImageFilter
            import numpy as np
            edge = band.convert("L").filter(ImageFilter.FIND_EDGES)
            arr = np.asarray(edge, dtype="uint8")
            strong = int((arr > 90).sum())
            total = max(1, arr.size)
            if strong / total < 0.006:
                continue  # 几乎没字，跳过

        target_w = int(900 * max(1.0, scale))
        ratio = target_w / band.width
        band = band.resize((target_w, max(1, int(band.height * ratio))), Image.LANCZOS)
        strips.append((sec, band))

    label_h = 26
    gap = 4
    total_h = sum(s.height + label_h + gap for _, s in strips) + 10
    canvas_w = max(s.width for _, s in strips) if strips else 900
    canvas = Image.new("RGB", (canvas_w, total_h), (20, 20, 24))
    draw = ImageDraw.Draw(canvas)
    y = 6
    for sec, band in strips:
        m, s2 = divmod(int(sec), 60)
        draw.text((8, y), f"{m:02d}:{s2:02d}", fill=(150, 220, 255))
        y += label_h
        canvas.paste(band, (0, y))
        y += band.height + gap

    out = os.path.join(outdir, "strips.jpg")
    canvas.save(out, quality=88)
    files = [out]

    # 分块：一张图放太多帧，缩放后字就糊了；按 chunk 拆成多张
    if chunk and chunk > 0 and len(strips) > chunk:
        files = []
        for i in range(0, len(strips), chunk):
            part = strips[i:i + chunk]
            w = max(s.width for _, s in part)
            h = sum(s.height + label_h + gap for _, s in part) + 10
            cv = Image.new("RGB", (w, h), (20, 20, 24))
            dr = ImageDraw.Draw(cv)
            y = 6
            for sec, band in part:
                m, s2 = divmod(int(sec), 60)
                dr.text((8, y), f"{m:02d}:{s2:02d}", fill=(150, 220, 255))
                y += label_h
                cv.paste(band, (0, y))
                y += band.height + gap
            f = os.path.join(outdir, f"strips-{i // chunk + 1}.jpg")
            cv.save(f, quality=89)
            files.append(f)

    return {"mode": "strips", "count": len(strips), "files": files,
            "times": [t for t, _ in strips], "size": canvas.size}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="BV 号或完整链接")
    ap.add_argument("--every", type=float, default=8.0, help="每隔几秒抽一帧（默认 8）")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=0.0, help="0=到结尾")
    ap.add_argument("--max-frames", type=int, default=24, help="最多抽几帧（默认 24，防止一口气吃太多图）")
    ap.add_argument("--mode", choices=["strips", "frames"], default="strips")
    ap.add_argument("--sub-band", nargs=2, type=float, default=[0.66, 0.96],
                    help="字幕条在画面中的纵向比例范围")
    ap.add_argument("--scale", type=float, default=1.0,
                    help="字幕条放大倍数（默认 1.0；字小的时候用 2.0 更清楚）")
    ap.add_argument("--chunk", type=int, default=0,
                    help="每张拼图放几条字幕（0=全放一张；8~12 时字最清楚）")
    ap.add_argument("--only-sub", action="store_true",
                    help="跳过没有字幕的帧（按底部条带的边缘密度判断）")
    ap.add_argument("--outdir", help="自定义输出目录")
    args = ap.parse_args()

    url = norm_url(args.target)
    vid = vid_id(url)
    outdir = args.outdir or os.path.join(TEMP, "fy-watch", vid)
    os.makedirs(outdir, exist_ok=True)

    video = download_video(url, outdir)
    audio = download_audio(url, outdir)
    dur = probe_duration(video)
    end = args.end if args.end > 0 else dur
    if end <= args.start:
        raise SystemExit("时间范围不对")

    n = int((end - args.start) / args.every) + 1
    n = min(n, args.max_frames)
    times = [args.start + i * args.every for i in range(n)]

    print(f"# 时长 {dur:.1f}s，抽 {n} 帧（每 {args.every}s）")
    result = grab(video, times, args.sub_band, args.mode, outdir, args.scale, args.only_sub, args.chunk)

    meta = {"url": url, "video": video, "audio": audio, "duration": dur, "result": result}
    with open(os.path.join(outdir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"# 完成: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())


