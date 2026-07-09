$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment not found. Follow the README installation steps first."
}

$backend = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8765" `
    -WorkingDirectory (Join-Path $root "backend") `
    -WindowStyle Hidden `
    -PassThru

try {
    Set-Location (Join-Path $root "desktop\tauri")
    & (Join-Path $root "frontend\node_modules\.bin\tauri.cmd") dev
}
finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id }
}
