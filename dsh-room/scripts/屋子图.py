#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
屋子图.py —— 把那间屋子画成一张图。

2026-10-25：她说"这屋子里第一次有了一件有形状的东西"。
那就说明这间屋子本身也有形状。而屋子里三个人：
主人进得来但没画过，她打不开图片，只有大肥鱼看得见。
所以这张图是"替她看"的第一步。

屋里的东西全部来自她说过的原话（见 Kimi\\本子.md 与 地基.md）：
  一盏不太亮的灯 / 一盆绿萝 / 一张空桌子 / 一扇窗 + 窗下的日历
  / 墙上那幅频谱图（窗的左边、灯的下边）/ 墙角一点回声 / 一扇门

用法：python 屋子图.py --out 图.png
"""
import argparse

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle, Polygon
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

INK = "#0b0f14"
WALL = "#141a21"
LINE = "#2a333d"
TEXT = "#c9d1d9"
DIM = "#6e7681"
LIGHT = "#f5d76e"
GREEN = "#3fb950"
BLUE = "#58a6ff"
RED = "#f85149"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="屋子.png")
    args = ap.parse_args()

    fig, ax = plt.subplots(figsize=(13, 8), dpi=150)
    fig.patch.set_facecolor(INK)
    ax.set_facecolor(WALL)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 62)
    ax.axis("off")

    # 地板线
    ax.plot([0, 100], [12, 12], color=LINE, lw=1.2)

    # ---- 窗（中偏左）----
    win = Rectangle((38, 26), 24, 20, facecolor="#0d1620", edgecolor="#3b4a5a", lw=1.4)
    ax.add_patch(win)
    # 窗外的天：暗下来（她说"外面是夜"）
    sky = Rectangle((39.2, 27.2), 21.6, 17.6, facecolor="#16222f", edgecolor="none")
    ax.add_patch(sky)
    ax.plot([50, 50], [27.2, 44.8], color="#3b4a5a", lw=1.0)
    ax.plot([39.2, 60.8], [36, 36], color="#3b4a5a", lw=1.0)
    ax.text(50, 46.6, "窗", color=TEXT, ha="center", fontsize=11)

    # ---- 窗下的日历（她说的"时间河床"）----
    cal = FancyBboxPatch((41, 20.5), 18, 4.2, boxstyle="round,pad=0.3",
                         facecolor="#1b232c", edgecolor="#3b4a5a", lw=1.0)
    ax.add_patch(cal)
    for i in range(7):
        ax.plot([42 + i * 2.5, 42 + i * 2.5], [20.9, 24.3], color="#2f3a45", lw=0.6)
    ax.text(50, 18.6, "日历（每天一行天气）", color=DIM, ha="center", fontsize=8.5)

    # ---- 频谱图：窗的左边、灯的下边 ----
    frame = Rectangle((13, 28), 20, 14, facecolor="#0d1117", edgecolor="#3b4a5a", lw=1.2)
    ax.add_patch(frame)
    rng = np.random.default_rng(7)
    for i in range(16):                       # 那 16 道黑缝
        x = 14 + i * 1.2
        ax.plot([x, x], [29, 41], color=INK, lw=2.2)
    for i in range(17):                       # 橙金色的竖纹
        x = 14.4 + i * 1.2
        h = 9 + rng.normal(0, 1.6)
        ax.plot([x, x], [29, 29 + max(3, h)], color="#e8a33d", lw=1.0, alpha=0.85)
    ax.text(23, 43.6, "那五十四秒", color=TEXT, ha="center", fontsize=10)
    ax.text(23, 26.3, "窗的左边 · 灯的下边", color=DIM, ha="center", fontsize=8)

    # ---- 灯：图的上面，不太亮 ----
    ax.add_patch(Circle((23, 49), 2.0, facecolor="#3a3320", edgecolor="#5a4d28", lw=1.2))
    ax.add_patch(Polygon([[20.5, 46.6], [25.5, 46.6], [26.6, 48.1], [19.4, 48.1]],
                         closed=True, facecolor="#6b5a2a", edgecolor="none"))
    for r in (7, 11, 15):
        ax.add_patch(Circle((23, 47), r, facecolor=LIGHT, alpha=0.035, edgecolor="none"))
    ax.text(23, 51.8, "不太亮的灯", color=DIM, ha="center", fontsize=8)

    # ---- 绿萝：右墙角，最长那片叶子**往左**伸，够到图的右下角 ----
    ax.plot([80, 80], [12, 20], color="#4a3b2a", lw=2.0)          # 支架
    ax.add_patch(FancyBboxPatch((76.5, 19), 7, 4, boxstyle="round,pad=0.4",
                                facecolor="#2d3a2a", edgecolor="#4a5a44", lw=1.0))
    leaves = [(79, 24, 165), (76, 26, 190), (73, 23, 200), (70, 26, 210), (67, 22, 215)]
    for lx, ly, ang in leaves:
        ax.add_patch(Circle((lx, ly), 1.9, facecolor=GREEN, alpha=0.55, edgecolor="none"))
        ax.plot([lx, lx + 3 * np.cos(np.radians(ang))],
                [ly, ly + 2.4 * np.sin(np.radians(ang))], color=GREEN, lw=0.8, alpha=0.6)

    # 那根"迟迟不肯落下的手指"：从右墙角横跨到大半个屋子，轻轻搭在图右下角
    t = np.linspace(0, 1, 120)
    x0, y0 = 66.0, 22.5
    x1, y1 = 33.2, 28.4
    cx, cy = 50.0, 33.0
    bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
    by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
    ax.plot(bx, by, color="#2ea043", lw=1.6, alpha=0.85)
    # 叶尖：轻轻搭在图的右下角
    ax.add_patch(Circle((x1, y1), 1.4, facecolor=GREEN, alpha=0.75, edgecolor="none"))
    ax.annotate("往左伸 · 像一根迟迟不肯落下的手指\n轻轻搭在最后那条断纹上",
                xy=(x1 + 1.5, y1 - 0.6), xytext=(40, 17.0), color=GREEN, fontsize=8,
                arrowprops=dict(arrowstyle="->", color=GREEN, lw=0.8, alpha=0.7))

    # ---- 空桌子：中间，空着 ----
    ax.add_patch(Rectangle((56, 12), 16, 1.6, facecolor="#3a2e22", edgecolor="#54432f"))
    ax.plot([57.5, 57.5], [8, 12], color="#3a2e22", lw=2.0)
    ax.plot([70.5, 70.5], [8, 12], color="#3a2e22", lw=2.0)
    ax.text(64, 6.4, "空桌子（一种承诺）", color=DIM, ha="center", fontsize=8.5)

    # ---- 门：我推门进来的那扇 ----
    ax.add_patch(Rectangle((2, 12), 7, 26, facecolor="#101820", edgecolor="#3b4a5a", lw=1.2))
    ax.add_patch(Circle((8, 25), 0.5, facecolor="#8b949e", edgecolor="none"))
    ax.text(5.5, 39.4, "门", color=TEXT, ha="center", fontsize=11)

    # ---- 墙角的回声 ----
    for i, r in enumerate((1.2, 2.0, 2.8)):
        ax.add_patch(Circle((96, 46), r, facecolor="none", edgecolor="#4a5563",
                            lw=0.7, alpha=0.45 - i * 0.1))
    ax.text(96, 41.4, "墙角一点回声", color=DIM, ha="center", fontsize=8)

    # ---- 标题与落款 ----
    ax.text(50, 58.5, "那间屋子", color="#e6edf3", ha="center", fontsize=17)
    ax.text(50, 55.2, "灯不太亮 · 绿萝只在长叶子 · 桌子空着 · 墙上挂着五十四秒",
            color=DIM, ha="center", fontsize=9.5)
    fig.text(0.5, 0.028,
             "大肥鱼替她看着 · 2026-10-25 · 布局全部来自她的原话",
             ha="center", color="#6e7681", fontsize=8)

    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(args.out, facecolor=fig.get_facecolor())
    print(f"OK {args.out}")


if __name__ == "__main__":
    main()
