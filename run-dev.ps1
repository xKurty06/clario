$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
$logDir = Join-Path $backendDir "logs"
$logFile = Join-Path $logDir "dev-backend.log"
$errorLogFile = Join-Path $logDir "dev-backend-error.log"
$healthUrl = "http://127.0.0.1:8766/health"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment not found. Follow the README installation steps first."
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existingBackend = $null
try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($response.status -eq "ok") {
        $existingBackend = $true
    }
}
catch {
    $existingBackend = $false
}

Write-Host "Backend log: $logFile"
Write-Host "Backend error log: $errorLogFile"

if ($existingBackend) {
    Write-Host "Reusing healthy backend at $healthUrl"
    $backend = $null
}
else {
    foreach ($path in @($logFile, $errorLogFile)) {
        if (Test-Path -LiteralPath $path) {
            try {
                Clear-Content -LiteralPath $path
            }
            catch {
                $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
                $archivedPath = "$path.$timestamp.locked"
                Move-Item -LiteralPath $path -Destination $archivedPath
                New-Item -ItemType File -Path $path | Out-Null
                Write-Host "Archived locked log to $archivedPath"
            }
        }
    }

    Write-Host "Starting backend on 127.0.0.1:8766..."
    $backend = Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8766", "--reload" `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $errorLogFile `
        -PassThru
}

try {
    $ready = $false
    if ($existingBackend) {
        $ready = $true
    }
    for ($attempt = 1; -not $ready -and $attempt -le 40; $attempt += 1) {
        if ($backend.HasExited) {
            $tail = @(
                if (Test-Path -LiteralPath $logFile) { Get-Content -LiteralPath $logFile -Tail 40 }
                if (Test-Path -LiteralPath $errorLogFile) { Get-Content -LiteralPath $errorLogFile -Tail 40 }
            ) | Out-String
            throw "Backend exited before becoming healthy.`n$tail"
        }

        try {
            $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
            if ($response.status -eq "ok") {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $ready) {
        $tail = @(
            if (Test-Path -LiteralPath $logFile) { Get-Content -LiteralPath $logFile -Tail 40 }
            if (Test-Path -LiteralPath $errorLogFile) { Get-Content -LiteralPath $errorLogFile -Tail 40 }
        ) | Out-String
        throw "Backend did not become healthy at $healthUrl.`n$tail"
    }

    Write-Host "Backend healthy at $healthUrl"
    Set-Location (Join-Path $root "desktop\tauri")
    & (Join-Path $root "frontend\node_modules\.bin\tauri.cmd") dev
}
finally {
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id
    }
}
