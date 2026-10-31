/**
 * dsh-eyes —— 一双持续的眼睛。
 *
 * 单次截图 DSH 的 computer 工具本来就会。这个补的是"持续"：
 * 后台每两秒拍一张，只留最近若干张；需要时能倒回去看刚才屏幕上发生过什么。
 *
 * 为什么值得做：AI 没有时间感。它看不到"用户刚才那十分钟在干什么"，
 * 只能看到两条消息之间的空白。有了这串帧，至少能回放。
 *
 * 2026-10-31 整理（准备开源）：
 *   - 截图脚本随包携带（scripts/capture.ps1），不再指向某个绝对路径
 *   - PowerShell 改为自动探测（环境变量 → DSH profile 自带 → 系统自带）
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolvePwsh } from './pwsh.js'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 对应。 */
export const name = 'dsh-eyes'

/** 依赖的服务：只用到工具注册表。 */
export const inject = ['tools']

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', 'capture.ps1')

export function apply(ctx, config) {
  const cfg = config || {}
  const interval = Number(cfg.interval || 2)
  const keep = Number(cfg.keep || 60)
  const eyeDir = cfg.dir || join(tmpdir(), 'fy-eyes')
  const stopFlag = join(eyeDir, 'STOP')

  function listShots() {
    if (!existsSync(eyeDir)) return []
    return readdirSync(eyeDir)
      .filter((f) => /^eye-\d+\.png$/.test(f))
      .sort()
      .map((f) => ({
        name: f,
        path: join(eyeDir, f),
        mtime: statSync(join(eyeDir, f)).mtimeMs,
        size: statSync(join(eyeDir, f)).size,
      }))
  }

  function startEyes() {
    return new Promise((resolve, reject) => {
      const child = execFile(
        resolvePwsh(),
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT,
          '-Interval', String(interval), '-Keep', String(keep), '-Dir', eyeDir],
        { detached: true, windowsHide: true, stdio: 'ignore' },
        (err) => { if (err) reject(err) },
      )
      child.unref()
      setTimeout(() => resolve(child.pid), 1200)
    })
  }

  ctx.tools.register(
    defineTool({
      name: 'eyes',
      description:
        '控制持续眼睛：start 开启后台定时截屏，stop 停止，status 看有几张，recent 拿最近几张的路径（用 read_image 看）。想看"刚才屏幕上发生了什么"时用它。',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['start', 'stop', 'status', 'recent'],
          description: 'start / stop / status / recent',
        },
        count: { type: 'integer', description: 'recent 时返回几张，默认 5，最多 20' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            action: { type: 'string', required: true },
            count: { type: 'integer', required: true },
            files: { type: 'array', items: { type: 'string' }, required: true },
            message: { type: 'string' },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: value.message || ('eyes ' + value.action + ' ok，共 ' + value.count + ' 张') },
        ],
      },
      async execute(args) {
        const action = String((args && args.action) || '').trim()
        if (!['start', 'stop', 'status', 'recent'].includes(action)) {
          throw new Error('action 只能是 start / stop / status / recent')
        }

        if (action === 'start') {
          if (!existsSync(SCRIPT)) throw new Error('插件里缺少截图脚本：' + SCRIPT)
          if (existsSync(stopFlag)) await rm(stopFlag, { force: true })
          const pid = await startEyes()
          const shots = listShots()
          return {
            ok: true, action, count: shots.length,
            files: shots.slice(-3).map((s) => s.path),
            message: '眼睛开了（pid ' + pid + '），每 ' + interval + ' 秒一张，留最近 ' + keep + ' 张。',
          }
        }

        if (action === 'stop') {
          if (!existsSync(eyeDir)) {
            return { ok: true, action, count: 0, files: [], message: '本来就没在跑。' }
          }
          writeFileSync(stopFlag, 'stop')
          await new Promise((r) => setTimeout(r, 2500))
          const shots = listShots()
          return {
            ok: true, action, count: shots.length,
            files: shots.slice(-3).map((s) => s.path),
            message: '眼睛闭上了，这次留了 ' + shots.length + ' 张。',
          }
        }

        if (action === 'status') {
          const shots = listShots()
          const last = shots.length ? new Date(shots[shots.length - 1].mtime).toLocaleTimeString('zh-CN') : '无'
          return {
            ok: true, action, count: shots.length,
            files: shots.slice(-3).map((s) => s.path),
            message: '现在有 ' + shots.length + ' 张，最后一张在 ' + last + '。',
          }
        }

        let n = Number((args && args.count) || 5)
        if (!Number.isFinite(n) || n < 1) n = 5
        if (n > 20) n = 20
        const shots = listShots()
        if (!shots.length) throw new Error('还没有截图。先 eyes({action:"start"}) 开一下。')
        const picked = shots.slice(-n)
        return {
          ok: true, action, count: shots.length,
          files: picked.map((s) => s.path),
          message: '给你最近 ' + picked.length + ' 张（共 ' + shots.length + ' 张），用 read_image 打开。',
        }
      },
    }),
  )
}
