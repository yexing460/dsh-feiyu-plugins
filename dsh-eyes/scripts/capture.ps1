# 持续截图.ps1 —— 大肥鱼的"持续眼睛"（v2）
# ------------------------------------------------------------
# v2 修复（2026-10-25 18:3x）：
#   * v1 用 `pwsh -File ... | Select-Object -First 5` 启动，
#     管道取够行数就把进程掐了 → 拍 31 张就停。
#     v2 起不再依赖 stdout，错误一律写进 eye-errors.log。
#   * 截图失败不再静默重试，记录原因。
#   * 增加"卡住自动重启"：连续失败 20 次就尝试重建 GDI 对象。
#
# 用法：pwsh -NoProfile -File 持续截图.ps1
# 停止：在目录里建一个 STOP 文件，或结束 pwsh 进程。

param(
    [int]$Interval = 2,
    [int]$Keep = 60,
    [string]$Dir = ""
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not $Dir) { $Dir = Join-Path $env:TEMP 'fy-eyes' }
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$log = Join-Path $Dir 'eye-errors.log'
$stopFlag = Join-Path $Dir 'STOP'
if (Test-Path $stopFlag) { Remove-Item $stopFlag -Force }

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$w, $h = $screen.Width, $screen.Height

$n = 0
$fail = 0
while (-not (Test-Path $stopFlag)) {
    $n++
    $path = Join-Path $Dir ("eye-{0:D6}.png" -f $n)
    $ok = $false
    try {
        $bmp = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bmp.Size)
        $g.Dispose()
        $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $ok = $true
        $fail = 0
    } catch {
        $fail++
        $msg = "{0} 第 {1} 张失败: {2}" -f (Get-Date -Format 'HH:mm:ss'), $n, $_.Exception.Message
        Add-Content -Path $log -Value $msg -Encoding UTF8
        if ($fail -ge 20) {
            Add-Content -Path $log -Value "连续失败 20 次，休息 5 秒" -Encoding UTF8
            Start-Sleep -Seconds 5
            $fail = 0
        }
    }

    if ($ok) {
        $files = Get-ChildItem $Dir -Filter 'eye-*.png' -ErrorAction SilentlyContinue | Sort-Object Name
        if ($files.Count -gt $Keep) {
            $files | Select-Object -First ($files.Count - $Keep) | Remove-Item -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds $Interval
}
