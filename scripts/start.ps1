$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) { throw 'Run scripts/setup.ps1 first.' }
if (-not (Test-Path -LiteralPath 'frontend/dist/index.html')) { throw 'Build the frontend first: cd frontend; npm ci; npm run build' }
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --ws-max-size 1300000
