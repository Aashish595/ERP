param([switch]$InstallDependencies)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function New-Secret([int]$Bytes = 48) {
    $buffer = New-Object byte[] $Bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    $rng.Dispose()
    return [Convert]::ToBase64String($buffer).Replace("+", "-").Replace("/", "_").TrimEnd("=")
}

function Read-DotEnv([string]$Path) {
    $values = @{}
    if (-not (Test-Path $Path)) { return $values }
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $parts = $line -split '=', 2
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Set-DotEnv([string]$Path, [string]$Name, [string]$Value) {
    $lines = @(Get-Content $Path)
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -match "^$([Regex]::Escape($Name))=") {
            $found = $true
            "$Name=$Value"
        } else { $line }
    }
    if (-not $found) { $updated += "$Name=$Value" }
    Set-Content -Path $Path -Value $updated -Encoding utf8
}

$OldEnv = Read-DotEnv (Join-Path $Root "backend\.env")

if (-not (Test-Path "server\.env")) { Copy-Item "server\.env.example" "server\.env" }
if (-not (Test-Path "ai-service\.env")) { Copy-Item "ai-service\.env.example" "ai-service\.env" }
if (-not (Test-Path "frontend\.env.local")) { Copy-Item "frontend\.env.local.example" "frontend\.env.local" }

$JwtSecret = New-Secret 64
$ServiceToken = New-Secret 48
Set-DotEnv "server\.env" "JWT_SECRET" $JwtSecret
Set-DotEnv "server\.env" "AI_SERVICE_TOKEN" $ServiceToken
Set-DotEnv "ai-service\.env" "AI_SERVICE_TOKEN" $ServiceToken

$ServerMappings = @{
    DATABASE_URL = "DATABASE_URL"; REDIS_URL = "REDIS_URL"; FRONTEND_BASE_URL = "FRONTEND_URL";
    BACKEND_URL = "PUBLIC_API_URL"; BACKEND_CORS_ORIGINS = "CORS_ORIGINS";
    CLOUDINARY_CLOUD_NAME = "CLOUDINARY_CLOUD_NAME"; CLOUDINARY_API_KEY = "CLOUDINARY_API_KEY";
    CLOUDINARY_API_SECRET = "CLOUDINARY_API_SECRET"; RAZORPAY_KEY_ID = "RAZORPAY_KEY_ID";
    RAZORPAY_KEY_SECRET = "RAZORPAY_KEY_SECRET"; BBB_URL = "BBB_URL"; BBB_SECRET = "BBB_SECRET"
}
foreach ($source in $ServerMappings.Keys) {
    if ($OldEnv.ContainsKey($source) -and $OldEnv[$source]) { Set-DotEnv "server\.env" $ServerMappings[$source] $OldEnv[$source] }
}
foreach ($name in @("OPENROUTER_API_KEY", "OPENAI_API_KEY")) {
    if ($OldEnv.ContainsKey($name) -and $OldEnv[$name]) { Set-DotEnv "ai-service\.env" $name $OldEnv[$name] }
}
if ($OldEnv.ContainsKey("MODEL") -and $OldEnv["MODEL"]) { Set-DotEnv "ai-service\.env" "AI_MODEL" $OldEnv["MODEL"] }

if ((Test-Path "backend") -and -not (Test-Path "backend-fastapi-legacy-backup")) {
    Rename-Item "backend" "backend-fastapi-legacy-backup"
}

if ($InstallDependencies) {
    Push-Location "server"
    npm install
    npm run typecheck
    Pop-Location
}

Write-Host "Express + FastAPI AI migration applied." -ForegroundColor Green
Write-Host "Review server\.env and ai-service\.env, then run: docker compose up --build"
Write-Host "The old backend was preserved as backend-fastapi-legacy-backup for rollback."
