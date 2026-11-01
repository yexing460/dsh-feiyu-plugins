#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扫描最近 N 小时的 DSH 会话转录，检查记忆库日记是否覆盖。

用途：补上"别的会话聊了但没写日记"的漏洞。
用法：
    python scan_sessions.py          # 最近 24 小时
    python scan_sessions.py 72       # 最近 72 小时

输出：每个会话的时间、工作区、用户消息数、对应日记是否存在。
"""
import os
import re
import sys
import json
import glob
import datetime
from compression import zstd

# 控制台可能是 GBK，强制 UTF-8 输出，避免中文/emoji 报 UnicodeEncodeError
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

SESSIONS = os.path.expanduser(r"~\.dsh\sessions")
DIARY_DIR = r"E:\大肥鱼工作区\肥鱼记忆库\记录"

SKIP_PREFIX = (
    '<system-reminder>',
    'Current runtime context.',
    'Time sampled',
    'The approval policy changed',
    'A skill is a reusable',
)


def decode_ws(dirname):
    """把 ~XXXX 形式的工作区目录名尽量还原成可读文字。"""
    s = dirname.strip('-')
    out = []
    i = 0
    while i < len(s):
        m = re.match(r'~([0-9A-Fa-f]{4})', s[i:])
        if m:
            out.append(chr(int(m.group(1), 16)))
            i += 5
        else:
            out.append(s[i])
            i += 1
    return ''.join(out)


def msg_text(msg):
    if isinstance(msg, str):
        return msg
    content = msg.get('content') if isinstance(msg, dict) else None
    if isinstance(content, str):
        return content
    out = []
    if isinstance(content, list):
        for p in content:
            if isinstance(p, dict) and p.get('type') == 'text':
                out.append(p.get('text', ''))
            elif isinstance(p, str):
                out.append(p)
    return '\n'.join(out)


def scan(path):
    raw = zstd.decompress(open(path, 'rb').read()).decode('utf-8', 'replace')
    msgs = []
    last_time = None
    for line in raw.splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        if o.get('type') != 'user/message':
            continue
        d = o.get('data', {})
        t = msg_text(d.get('message', d)).strip()
        if not t or t.startswith(SKIP_PREFIX):
            continue
        msgs.append(t)
        if o.get('time'):
            last_time = o['time']
    return msgs, last_time


def main():
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    now = datetime.datetime.now()
    cutoff = now - datetime.timedelta(hours=hours)

    rows = []
    pattern = os.path.join(SESSIONS, '*', '*', 'session.v4.jsonl.zstd')
    for p in glob.glob(pattern):
        mt = datetime.datetime.fromtimestamp(os.path.getmtime(p))
        if mt < cutoff:
            continue
        try:
            msgs, _ = scan(p)
        except Exception as e:
            msgs = []
        ws_dir = os.path.basename(os.path.dirname(os.path.dirname(p)))
        ws = decode_ws(ws_dir)
        day = mt.strftime('%Y-%m-%d')
        diary = os.path.join(DIARY_DIR, day + '.md')
        has = os.path.exists(diary)
        # 日记的修改时间若早于会话结束时间 → 日记里不可能覆盖这个会话
        diary_mt = datetime.datetime.fromtimestamp(os.path.getmtime(diary)) if has else None
        stale = bool(has and diary_mt and diary_mt < mt)
        rows.append({
            'mtime': mt,
            'ws': ws,
            'sid': os.path.basename(os.path.dirname(p)),
            'n': len(msgs),
            'day': day,
            'diary': diary,
            'has': has,
            'stale': stale,
            'diary_mt': diary_mt,
            'last': msgs[-1][:40] if msgs else '',
        })

    rows.sort(key=lambda r: r['mtime'])

    print(f"=== 会话扫描（最近 {hours} 小时，截至 {now:%Y-%m-%d %H:%M}）===")
    print(f"转录 {len(rows)} 个\n")
    for i, r in enumerate(rows, 1):
        if not r['has']:
            flag = '★ 缺失'
        elif r['stale']:
            flag = f"存在但★可能未覆盖（日记 {r['diary_mt']:%H:%M} 早于会话 {r['mtime']:%H:%M}）"
        else:
            flag = f"存在（{r['diary_mt']:%H:%M}）"
        print(f"  [{i}] {r['mtime']:%m-%d %H:%M}  {r['ws']}")
        print(f"       消息 {r['n']:4d} 条   日记 {os.path.basename(r['diary'])}: {flag}")
        if r['last']:
            print(f"       最后一条: {r['last']}")
        print()

    gap = [r for r in rows if not r['has']]
    stale = [r for r in rows if r['stale']]
    if not gap and not stale:
        print("结论：无缺口 ✅")
    else:
        print("结论：★ 需要检查/补记：")
        for r in gap:
            print(f"   - [缺日记] {r['mtime']:%Y-%m-%d %H:%M}  {r['ws']}  ({r['n']} 条消息)")
        for r in stale:
            print(f"   - [疑未覆盖] {r['mtime']:%Y-%m-%d %H:%M}  {r['ws']}  ({r['n']} 条消息, {r['sid'][:16]})")


if __name__ == '__main__':
    main()
