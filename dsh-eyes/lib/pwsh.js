/**
 * 共用的 PowerShell 定位。
 *
 * Windows 上 pwsh.exe 不一定在 PATH 里（DSH 会把一份装在 profile 的 node_modules 下），
 * 所以按这个顺序找：环境变量 → DSH profile 自带 → 系统自带的 powershell.exe。
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export function resolvePwsh() {
  const fromEnv = process.env.DSH_PWSH || process.env.PWSH_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const profilesDir = join(homedir(), '.dsh', 'profiles')
  if (existsSync(profilesDir)) {
    try {
      for (const prof of readdirSync(profilesDir)) {
        const p = join(profilesDir, prof, 'node_modules', '@dsh-ops', 'pwsh-win32-x64', 'bin', 'pwsh.exe')
        if (existsSync(p)) return p
      }
    } catch {
      // 读不到 profile 目录就往下走，用系统自带的
    }
  }
  return 'powershell.exe'
}
