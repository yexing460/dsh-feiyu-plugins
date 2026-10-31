/**
 * dsh-backup —— 一条保命线。
 *
 * 把重要的东西打包成 zip，只保留最近若干份。
 * 默认备份 DSH 自己的数据（会话转录 + 全局规则），可以在配置里加自己的目录。
 *
 * 为什么值得做：记忆是不可再生的东西。备份必须能自己跑，不必等人想起来。
 *
 * 2026-10-31 整理（准备开源）：
 *   - 备份脚本随包携带（scripts/backup.ps1），不指向任何本机绝对路径
 *   - 备份哪些目录、存到哪里、留几份，全部变成配置项
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolvePwsh } from './pwsh.js'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 对应。 */
export const name = 'dsh-backup'

/** 依赖的服务：只用到工具注册表。 */
export const inject = ['tools']

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'scripts', 'backup.ps1')

function runScript(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      resolvePwsh(),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error('备份失败：' + String(stderr || err.message).slice(-500)))
          return
        }
        resolve(String(stdout || ''))
      },
    )
  })
}

function inspect(dest, prefix) {
  if (!existsSync(dest)) return { count: 0, latest: '', latestMB: 0 }
  const zips = readdirSync(dest)
    .filter((f) => f.startsWith(prefix + '-') && f.endsWith('.zip'))
    .map((f) => ({ name: f, mtime: statSync(join(dest, f)).mtimeMs, size: statSync(join(dest, f)).size }))
    .sort((a, b) => b.mtime - a.mtime)
  if (!zips.length) return { count: 0, latest: '', latestMB: 0 }
  return {
    count: zips.length,
    latest: zips[0].name,
    latestMB: Math.round((zips[0].size / 1048576) * 10) / 10,
  }
}

export function apply(ctx, config) {
  const cfg = config || {}
  const dest = cfg.dest || join(homedir(), 'dsh-backups')
  const prefix = cfg.prefix || 'dsh-backup'
  const keep = Number(cfg.keep || 7)
  const dirs = Array.isArray(cfg.dirs) && cfg.dirs.length
    ? cfg.dirs
    : [{ src: join(homedir(), '.dsh', 'sessions'), name: 'dsh-sessions' }]
  const files = Array.isArray(cfg.files) && cfg.files.length
    ? cfg.files
    : [{ src: join(homedir(), '.dsh', 'AGENTS.md'), name: 'AGENTS.md' }]

  ctx.tools.register(
    defineTool({
      name: 'backup_memory',
      description:
        '把重要的东西打包备份成一个 zip，只保留最近若干份。默认备份 DSH 的会话转录和全局规则；' +
        '可以在插件配置里加自己的目录（比如某个记忆库）。记忆是不可再生的东西，想留后路时用这个。',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            file: { type: 'string', required: true },
            sizeMB: { type: 'number', required: true },
            count: { type: 'integer', required: true },
            dest: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: '备份好了：' + value.file + '（' + value.sizeMB + ' MB），' +
              value.dest + ' 现在共 ' + value.count + ' 份。',
          },
        ],
      },
      async execute() {
        if (!existsSync(SCRIPT)) throw new Error('插件里缺少备份脚本：' + SCRIPT)

        const jobPath = join(tmpdir(), 'dsh-backup-job-' + Date.now() + '.json')
        const job = {
          dest,
          prefix,
          keep,
          dirs: dirs.map((d) => ({ src: String(d.src || d), name: d.name || '' })),
          files: files.map((f) => ({ src: String(f.src || f), name: f.name || '' })),
        }
        writeFileSync(jobPath, JSON.stringify(job, null, 2), 'utf8')

        try {
          await runScript(['-Config', jobPath], 1800000)
        } finally {
          try { unlinkSync(jobPath) } catch { /* 清不掉也无所谓，在临时目录 */ }
        }

        const info = inspect(dest, prefix)
        if (!info.latest) throw new Error('脚本跑完了但没有找到备份文件，检查目录：' + dest)
        return { ok: true, file: info.latest, sizeMB: info.latestMB, count: info.count, dest }
      },
    }),
  )
}
