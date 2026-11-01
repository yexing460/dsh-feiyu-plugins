/**
 * dsh-watch —— 给大肥鱼一双眼睛（2026-10-29 第二版，纯 JS）。
 *
 * 以前看视频要人敲：python 看视频.py BV号
 * 现在它是我的工具：给它一个 BV 号，它把字幕条抽成带时间戳的拼图，我直接看图。
 *
 * 真正的重活在 Python 脚本里（yt-dlp 下载 + av 抽帧 + Pillow 裁条），这里只做调用。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 一致。 */
export const name = 'dsh-watch'

/** 依赖的服务：只用工具注册。 */
export const inject = ['tools']


const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', '看视频.py')
const PYTHON = process.env.DSH_PYTHON || 'python'

/** 跑看视频脚本：参数数组直接拼成命令行参数，不经过 shell。 */
function runWatch(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    execFile(
      PYTHON,
      [SCRIPT, ...args],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('看视频脚本失败：' + (stderr || err.message)))
          return
        }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
      },
    )
  })
}

/** 从脚本输出里抠产物：脚本打的是 Python 单引号字典，不按 JSON 解析，直接抠路径。 */
function parseResult(stdout) {
  // 找所有形如 .jpg 的路径（含反斜杠转义）
  const files = []
  const re = /([A-Za-z]:[^'",\]]*\.jpg)/g
  let m
  while ((m = re.exec(stdout)) !== null) {
    let p = m[1]
    // Python repr 里是双反斜杠，还原成单反斜杠
    p = p.replace(/\\\\/g, '\\')
    if (!files.includes(p)) files.push(p)
  }
  // count / times 单独抠
  const countM = stdout.match(/'count':\s*(\d+)/)
  const timesM = stdout.match(/'times':\s*\[([^\]]*)\]/)
  let times = []
  if (timesM) {
    times = timesM[1]
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n))
  }
  return { files, count: countM ? Number(countM[1]) : files.length, times }
}

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'watch_video',
      description:
        '看一个 B 站视频：下载 → 抽帧 → 把烧在画面里的字幕条裁下来竖着拼成带时间戳的图。返回图片路径，需要用 read_image 打开看。默认只看字幕条（省图），mode=frames 才给完整画面。',
      parameters: {
        target: { type: 'string', required: true, description: 'BV 号（如 BV1w6a86gEbC）或完整视频链接' },
        every: { type: 'number', description: '每隔几秒抽一帧，默认 8' },
        mode: {
          type: 'string',
          enum: ['strips', 'frames'],
          description: 'strips=只看字幕条拼图（默认，省）；frames=完整关键帧（看表情/场景时用）',
        },
        max_frames: { type: 'integer', description: '最多抽几帧，默认 24（防止一口气吃太多图）' },
        chunk: { type: 'integer', description: '每张拼图放几条字幕；0=全放一张。字小看不清时用 8~12' },
        start: { type: 'number', description: '从第几秒开始，默认 0' },
        end: { type: 'number', description: '到第几秒结束，0=到片尾' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            count: { type: 'integer', required: true },
            files: { type: 'array', items: { type: 'string' }, required: true },
            times: { type: 'array', items: { type: 'number' }, required: true },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text:
              '看了 ' + value.count + ' 个时间点，图在：' +
              (value.files || []).join(' / ') +
              '（用 read_image 打开看）',
          },
        ],
      },
      async execute(args) {
        const target = String((args && args.target) || '').trim()
        if (!target) throw new Error('target 不能为空（BV 号或链接）')
        if (!existsSync(SCRIPT)) throw new Error('找不到脚本：' + SCRIPT)

        const argv = [target]
        if (args.every) argv.push('--every', String(args.every))
        if (args.mode === 'frames') argv.push('--mode', 'frames')
        if (args.max_frames) argv.push('--max-frames', String(args.max_frames))
        if (args.chunk) argv.push('--chunk', String(args.chunk))
        if (args.start) argv.push('--start', String(args.start))
        if (args.end) argv.push('--end', String(args.end))

        const { stdout } = await runWatch(argv, 300000)
        const r = parseResult(stdout)
        if (!r.files.length) throw new Error('脚本跑完了但没产出图：' + stdout.slice(-300))
        return { ok: true, count: r.count, files: r.files, times: r.times }
      },
    }),
  )
}

