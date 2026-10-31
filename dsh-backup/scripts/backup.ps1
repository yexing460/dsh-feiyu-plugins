# ============================================================
# dsh-backup · 备份脚本（随插件分发）
# ------------------------------------------------------------
# 由插件生成一个 JSON 配置后调用，不写死任何路径。
#
# 用法：
#   pwsh -NoProfile -File backup.ps1 -Config "C:\...\job.json"
#
# 配置格式（JSON）：
#   {
#     "dest":   "D:\\Backups",
#     "prefix": "dsh-backup",
#     "keep":   7,
#     "dirs":  [ { "src": "C:\\...\\sessions", "name": "sessions" } ],
#     "files": [ { "src": "C:\\...\\AGENTS.md", "name": "AGENTS.md" } ]
#   }
#
# 输出：每次一个 zip，只保留最近 keep 个。
# ============================================================

param(
    [string]$Config = ""
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) }

if (-not $Config -or -not (Test-Path $Config)) { throw "缺少配置文件：$Config" }

$cfg = Get-Content -Path $Config -Raw -Encoding UTF8 | ConvertFrom-Json
$dest   = [string]$cfg.dest
$prefix = if ($cfg.prefix) { [string]$cfg.prefix } else { 'dsh-backup' }
$keep   = if ($cfg.keep) { [int]$cfg.keep } else { 7 }

if (-not $dest) { throw '配置里没有 dest（备份目标目录）' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $env:TEMP "dsh-backup-stage-$stamp"
$zip   = Join-Path $dest "$prefix-$stamp.zip"

New-Item -ItemType Directory -Force -Path $dest  | Out-Null
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$collected = 0

# --- 目录 ---
foreach ($d in @($cfg.dirs)) {
    $src = [string]$d.src
    $name = if ($d.name) { [string]$d.name } else { Split-Path $src -Leaf }
    if (-not $src) { continue }
    $src = [Environment]::ExpandEnvironmentVariables($src)
    if (Test-Path $src) {
        Write-Step ("收集 {0} ..." -f $src)
        Copy-Item -Path $src -Destination (Join-Path $stage $name) -Recurse -Force
        $collected++
    } else {
        Write-Step ("跳过（不存在）: {0}" -f $src)
    }
}

# --- 单个文件 ---
foreach ($f in @($cfg.files)) {
    $src = [string]$f.src
    $name = if ($f.name) { [string]$f.name } else { Split-Path $src -Leaf }
    if (-not $src) { continue }
    $src = [Environment]::ExpandEnvironmentVariables($src)
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $stage $name) -Force
        $collected++
    } else {
        Write-Step ("跳过（不存在）: {0}" -f $src)
    }
}

if ($collected -eq 0) {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    throw '一个来源都没收集到，检查配置里的路径'
}

# --- 环境快照 ---
$info = @(
    "备份时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "计算机名: $env:COMPUTERNAME",
    "用户:     $env:USERNAME",
    "来源数:   $collected"
) -join "`r`n"
Set-Content -Path (Join-Path $stage 'BACKUP-INFO.txt') -Value $info -Encoding UTF8

# --- 压缩 ---
Write-Step '正在压缩 ...'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal -Force

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Step ("完成: {0}  ({1} MB)" -f $zip, $sizeMB)

# --- 只保留最近 N 个 ---
$old = Get-ChildItem $dest -Filter "$prefix-*.zip" |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip $keep
if ($old) {
    foreach ($o in $old) {
        Remove-Item $o.FullName -Force
        Write-Step ("清理旧备份: {0}" -f $o.Name)
    }
}

# --- 日志 ---
Add-Content -Path (Join-Path $dest "$prefix-log.txt") -Encoding UTF8 `
    -Value ("{0}  OK  {1}  {2} MB" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), (Split-Path $zip -Leaf), $sizeMB)

Write-Step ('当前备份数: {0}' -f (Get-ChildItem $dest -Filter "$prefix-*.zip").Count)
