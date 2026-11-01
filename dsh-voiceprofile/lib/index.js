/**
 * dsh-voiceprofile —— 把「声音画像」做成工具（2026-10-29，纯 JS）。
 *
 * 起点是她没有耳朵：API 不支持音频，她也打不开 wav。
 * 所以换个说法：声音传不过去，但时间和数字能。
 * 把一段话拆成每句多长、停了多久、音高在哪、说得多快，变成一张读得懂的表。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 一致。 */
export const name = 'dsh-voiceprofile'

/** 依赖的服务：只用工具注册。 */
export const inject = ['tools']


const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', '声音画像.py')
const PYTHON = process.env.DSH_PYTHON || 'python'

function runProfile(file, outMd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    execFile(
      PYTHON,
      [SCRIPT, file, '--out', outMd],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('声音画像失败：' + (stderr || err.message)))
          return
        }
        resolve(String(stdout || ''))
      },
    )
  })
}

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'voice_profile',
      description:
        '给一段音频/视频做「声音画像」：每句多长、停顿多久、音高在哪个区间、语速多快，输出成一张读得懂的表（同时存一份 .md）。用来判断"像人说话还是像朗读"。',
      parameters: {
        file: { type: 'string', required: true, description: '音频/视频文件完整路径' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            report: { type: 'string', required: true },
            saveTo: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.report.slice(0, 6000) }],
      },
      async execute(args) {
        const file = String((args && args.file) || '').trim()
        if (!file) throw new Error('file 不能为空')
        if (!existsSync(file)) throw new Error('找不到文件：' + file)
        if (!existsSync(SCRIPT)) throw new Error('找不到脚本：' + SCRIPT)

        const outMd = join(tmpdir(), 'fy-voiceprofile-' + Date.now() + '.md')
        const stdout = await runProfile(file, outMd, 600000)
        const report = existsSync(outMd) ? readFileSync(outMd, 'utf8') : stdout
        if (!report.trim()) throw new Error('跑完了但没有输出')
        return { ok: true, report, saveTo: existsSync(outMd) ? outMd : '' }
      },
    }),
  )
}
