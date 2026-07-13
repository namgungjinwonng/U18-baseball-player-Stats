param(
  [switch]$Serve,
  [int]$Port = 5174
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Run-Step([string]$Title, [scriptblock]$Action) {
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Title failed (exit $LASTEXITCODE)" }
}

Run-Step "Scraper TypeScript" {
  Push-Location "$root\scraper"
  try { & npm.cmd exec tsc -- --noEmit } finally { Pop-Location }
}

Run-Step "Scraper regression tests" {
  Push-Location "$root\scraper"
  try { & npm.cmd test } finally { Pop-Location }
}

Run-Step "Season data integrity" {
  Push-Location "$root\scraper"
  try { & npm.cmd run validate-data } finally { Pop-Location }
}

Run-Step "Career calculation (synthetic + real player)" {
  & "$root\scraper\node_modules\.bin\tsx.cmd" "$root\web\src\shared\career.test.ts"
}

Run-Step "Web production build" {
  Push-Location "$root\web"
  try { & npm.cmd run build } finally { Pop-Location }
}

Write-Host "`nAll automated checks passed." -ForegroundColor Green
Write-Host "Manual checklist: $root\VERIFICATION.md"

if ($Serve) {
  Write-Host "`nStarting mobile verification server: http://localhost:$Port" -ForegroundColor Yellow
  Write-Host "Stop with Ctrl+C."
  Push-Location "$root\web"
  try { & npm.cmd run dev -- --host 127.0.0.1 --port $Port } finally { Pop-Location }
}
