$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path ".").Path
$LogDir = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$RunId = "20260501-1325-run-002"
$DatabaseUrl = $env:SMOKE_DATABASE_URL
if (-not $DatabaseUrl) { throw "SMOKE_DATABASE_URL is required" }
$BackendPort = 8001
$FrontendPort = 5173
$CdpPort = 9222
$ChromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe"
$ChromeProfile = Join-Path ([System.IO.Path]::GetTempPath()) "$RunId-chrome-profile-$PID"
$ServiceStopLog = Join-Path $LogDir "service-stop.log"

New-Item -ItemType Directory -Force -Path $ChromeProfile | Out-Null

Push-Location (Join-Path $RepoRoot "backend")
$env:DATABASE_URL = $DatabaseUrl
$env:APP_DEBUG = "false"
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
python (Join-Path $LogDir "scripts/setup_smoke_db.py") 2>&1 | Tee-Object -FilePath (Join-Path $LogDir "smoke-db-setup.log")
$setupExit = $LASTEXITCODE
$ErrorActionPreference = $oldErrorActionPreference
if ($setupExit -ne 0) { throw "smoke database setup failed with exit code $setupExit" }
Pop-Location

$backend = $null
$frontend = $null
$chrome = $null

try {
  $backend = Start-Process -FilePath "python" `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort") `
    -WorkingDirectory (Join-Path $RepoRoot "backend") `
    -RedirectStandardOutput (Join-Path $LogDir "backend.log") `
    -RedirectStandardError (Join-Path $LogDir "backend.err.log") `
    -PassThru `
    -WindowStyle Hidden

  $frontendCommand = "`$env:VITE_API_URL='http://localhost:$BackendPort'; pnpm run dev -- --host 127.0.0.1 --port $FrontendPort"
  $frontend = Start-Process -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand) `
    -WorkingDirectory (Join-Path $RepoRoot "frontend") `
    -RedirectStandardOutput (Join-Path $LogDir "frontend-dev.log") `
    -RedirectStandardError (Join-Path $LogDir "frontend-dev.err.log") `
    -PassThru `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(45)
  do {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/health" -Method Get -TimeoutSec 2
      if ($health.status -eq "ok") { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if ((Get-Date) -ge $deadline) { throw "backend health check timed out" }

  $deadline = (Get-Date).AddSeconds(45)
  do {
    try {
      $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort" -Method Get -TimeoutSec 2
      if ($resp.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if ((Get-Date) -ge $deadline) { throw "frontend health check timed out" }

  $chrome = Start-Process -FilePath $ChromePath `
    -ArgumentList @(
      "--remote-debugging-port=$CdpPort",
      "--user-data-dir=$ChromeProfile",
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank"
    ) `
    -PassThru `
    -WindowStyle Hidden

  $env:LOG_DIR = $LogDir
  $env:REPO_ROOT = $RepoRoot
  $env:RUN_ID = $RunId
  $env:CDP_PORT = "$CdpPort"
  $env:API_BASE_URL = "http://localhost:$BackendPort"
  $env:WEB_BASE_URL = "http://127.0.0.1:$FrontendPort"
  $env:DATABASE_URL = $DatabaseUrl
  $oldErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & node (Join-Path $LogDir "scripts/smoke-cdp.mjs") *> (Join-Path $LogDir "smoke-cdp.log")
  $exit = $global:LASTEXITCODE
  $ErrorActionPreference = $oldErrorActionPreference
  $exit | Out-File -FilePath (Join-Path $LogDir "smoke-cdp.exitcode") -Encoding ascii
  exit $exit
}
finally {
  "[$(Get-Date -Format o)] stopping smoke services" | Out-File -FilePath $ServiceStopLog -Encoding utf8
  if ($chrome -and -not $chrome.HasExited) {
    Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
    "stopped chrome pid=$($chrome.Id)" | Out-File -FilePath $ServiceStopLog -Append -Encoding utf8
  }
  if ($frontend -and -not $frontend.HasExited) {
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    "stopped frontend pid=$($frontend.Id)" | Out-File -FilePath $ServiceStopLog -Append -Encoding utf8
  }
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    "stopped backend pid=$($backend.Id)" | Out-File -FilePath $ServiceStopLog -Append -Encoding utf8
  }
  if (Test-Path -LiteralPath $ChromeProfile) {
    Remove-Item -LiteralPath $ChromeProfile -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $ChromeProfile) {
      "chrome profile cleanup failed: $ChromeProfile" | Out-File -FilePath $ServiceStopLog -Append -Encoding utf8
    } else {
      "removed chrome profile: $ChromeProfile" | Out-File -FilePath $ServiceStopLog -Append -Encoding utf8
    }
  }
}
