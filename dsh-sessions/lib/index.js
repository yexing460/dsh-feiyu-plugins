/**
 * dsh-sessions —— 给大肥鱼一面镜子（2026-10-29，纯 JS）。
 *
 * 以前查"有没有漏记"要敲 python scan_sessions.py。
 * 现在它是我的工具：扫最近若干小时的会话转录，看哪些聊过而日记里没写。
 *
 * 为什么值得做：我记性靠日记，日记靠"想得起来"。这个工具是异步的补漏网。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 一致。 */
export const name = 'dsh-sessions'

/** 依赖的服务：只用工具注册。 */
export const inject = ['tools']


const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', 'scan_sessions.py')
const PYTHON = process.env.DSH_PYTHON || 'python'

function runScan(hours, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    execFile(
      PYTHON,
      [SCRIPT, String(hours)],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('扫会话失败：' + (stderr || err.message)))
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
      name: 'scan_sessions',
      description:
        '扫最近若干小时的 DSH 会话转录，列出每个会话的时间、工作区、用户消息数，以及对应日记是否已覆盖。用来查"聊过但没写进记忆库"的漏洞。',
      parameters: {
        hours: { type: 'integer', description: '往回扫几小时，默认 24' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            hours: { type: 'integer', required: true },
            report: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: '最近 ' + value.hours + ' 小时的会话：\n\n' + value.report },
        ],
      },
      async execute(args) {
        let hours = Number((args && args.hours) || 24)
        if (!Number.isFinite(hours) || hours < 1) hours = 24
        if (hours > 720) hours = 720
        if (!existsSync(SCRIPT)) throw new Error('找不到脚本：' + SCRIPT)

        const report = await runScan(hours, 300000)
        if (!report.trim()) throw new Error('扫完了但没有任何输出')
        return { ok: true, hours, report: report.slice(0, 20000) }
      },
    }),
  )
}
