#
# Wrapper for scheduled daily backups.
# Runs scripts\backup.mjs and logs to scripts\backup.log.
#
# To schedule via Windows Task Scheduler:
#   1. Open Task Scheduler
#   2. Create Basic Task -> "SRB Daily Backup"
#   3. Trigger: Daily at 02:00 AM
#   4. Action: Start a program
#      Program/script:  powershell.exe
#      Add arguments:   -ExecutionPolicy Bypass -File "C:\Users\hadi2\srb-sim\scripts\backup.ps1"
#      Start in:        C:\Users\hadi2\srb-sim
#

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

$logFile = Join-Path $ScriptDir "backup.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    & node "scripts\backup.mjs" 2>&1 | Tee-Object -FilePath $logFile -Append
    Add-Content -Path $logFile -Value "[$timestamp] run finished"
    exit 0
} catch {
    Add-Content -Path $logFile -Value "[$timestamp] FAILED: $_"
    exit 1
}
