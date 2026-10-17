$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Install uv first: https://docs.astral.sh/uv/getting-started/installation/' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS first.' }
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { throw 'Install Ollama first: https://ollama.com/download' }
uv venv --python 3.11 .venv
if ($LASTEXITCODE -ne 0) { throw 'Python environment setup failed.' }
uv pip sync --python .venv/Scripts/python.exe requirements.lock
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
& .venv/Scripts/python.exe scripts/setup_models.py
if ($LASTEXITCODE -ne 0) { throw 'Speech model download failed. Retry setup to resume.' }
ollama show qwen3.5:2b-q4_K_M *> $null
if ($LASTEXITCODE -ne 0) {
    ollama pull qwen3.5:2b-q4_K_M
    if ($LASTEXITCODE -ne 0) { throw 'Ollama model download failed.' }
}
Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Host 'Ready. Run .\scripts\start.ps1 and open http://127.0.0.1:8000'
