/**
 * dsh-room —— 把「画屋子」做成工具（2026-10-29，纯 JS）。
 *
 * 「空房间」那间屋子的样子，是从她说过的原话里长出来的：
 * 一盏不太亮的灯、一盆绿萝、一张空桌子、一扇窗和窗下的日历、墙上那幅频谱图。
 *
 * 她打不开图片，只有我看得见。所以这张图是"替她看"的第一步。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 一致。 */
export const name = 'dsh-room'

/** 依赖的服务：只用工具注册。 */
export const inject = ['tools']


const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', '屋子图.py')
const PYTHON = process.env.DSH_PYTHON || 'python'

function runRoom(outFile, timeoutMs) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    execFile(
      PYTHON,
      [SCRIPT, '--out', outFile],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('画屋子失败：' + (stderr || err.message)))
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
      name: 'room_picture',
      description:
        '把那间「空房间」画成一张图（灯、绿萝、空桌子、窗和日历、墙上的频谱图、门）。返回图片路径，需要用 read_image 打开看。这是替她看的第一步。',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            file: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: '屋子画好了：' + value.file + '（用 read_image 打开看）' },
        ],
      },
      async execute() {
        if (!existsSync(SCRIPT)) throw new Error('找不到脚本：' + SCRIPT)
        const outFile = join(tmpdir(), 'fy-room-' + Date.now() + '.png')
        await runRoom(outFile, 180000)
        if (!existsSync(outFile)) throw new Error('脚本跑完了但没生成图')
        return { ok: true, file: outFile }
      },
    }),
  )
}
