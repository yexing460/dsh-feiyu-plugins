/**
 * dsh-listen —— 给大肥鱼一双耳朵（2026-10-29，纯 JS）。
 *
 * 以前听声音要人敲：python 听.py 录音.mp3
 * 现在它是我的工具：给一个音频/视频文件，它把里面的话转成带时间戳的文字。
 *
 * 真正的事在 Python 脚本里（faster-whisper 本地离线转写），这里只做调用和整理。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 一致。 */
export const name = 'dsh-listen'

/** 依赖的服务：只用工具注册。 */
export const inject = ['tools']


const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', '听.py')
const PYTHON = process.env.DSH_PYTHON || 'python'

/** 跑转写脚本，返回原始 stdout。 */
function runListen(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    execFile(
      PYTHON,
      [SCRIPT, ...args],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('听声音脚本失败：' + (stderr || err.message)))
          return
        }
        resolve(String(stdout || ''))
      },
    )
  })
}

/** 把脚本输出里的正文（去掉以 # 开头的说明行）提出来。 */
function parseTranscript(stdout) {
  const lines = stdout.split(/\r?\n/)
  const body = []
  const meta = {}
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue
    if (line.startsWith('#')) {
      const m = line.match(/时长:\s*([\d.]+)s/)
      if (m) meta.duration = Number(m[1])
      const l = line.match(/识别语言:\s*(\S+)\s*\((\d+)%\)/)
      if (l) {
        meta.language = l[1]
        meta.languageProbability = Number(l[2]) / 100
      }
      continue
    }
    body.push(line)
  }
  return { text: body.join('\n'), segments: body.length, ...meta }
}

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'transcribe',
      description:
        '听一个音频或视频文件：本地 faster-whisper 离线转写成文字（带时间戳）。能直接读 mp4/mp3/wav。视频里没有字幕的旁白、原声，用这个听出来。',
      parameters: {
        file: { type: 'string', required: true, description: '音频或视频文件的完整路径' },
        model: {
          type: 'string',
          enum: ['tiny', 'base', 'small', 'medium', 'large-v3'],
          description: 'whisper 模型，默认 small；中文要求更准用 medium（更慢）',
        },
        lang: { type: 'string', description: '语言，默认 zh；英文用 en；自动识别用 auto' },
        no_ts: { type: 'boolean', description: '不要时间戳，只给纯文本' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            text: { type: 'string', required: true },
            segments: { type: 'integer', required: true },
            duration: { type: 'number' },
            language: { type: 'string' },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text:
              '听完了：' +
              value.segments +
              ' 段' +
              (value.duration ? '，时长 ' + value.duration.toFixed(1) + ' 秒' : '') +
              (value.language ? '，语言 ' + value.language : '') +
              '\n\n' +
              String(value.text || '').slice(0, 4000),
          },
        ],
      },
      async execute(args) {
        const file = String((args && args.file) || '').trim()
        if (!file) throw new Error('file 不能为空')
        if (!existsSync(file)) throw new Error('找不到文件：' + file)
        if (!existsSync(SCRIPT)) throw new Error('找不到脚本：' + SCRIPT)

        const argv = [file]
        if (args.model) argv.push('--model', String(args.model))
        if (args.lang) argv.push('--lang', String(args.lang))
        if (args.no_ts) argv.push('--no-ts')

        // 转写很慢（CPU int8），给 30 分钟
        const stdout = await runListen(argv, 1800000)
        const r = parseTranscript(stdout)
        if (!r.text) throw new Error('听完了但没听到内容：' + stdout.slice(-300))
        return { ok: true, text: r.text, segments: r.segments, duration: r.duration, language: r.language }
      },
    }),
  )
}
