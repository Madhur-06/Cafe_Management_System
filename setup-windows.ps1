$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "== POS Cafe setup starting ==" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created root .env from .env.example" -ForegroundColor Yellow
}

if (-not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env"
  Write-Host "Created backend\.env from backend\.env.example" -ForegroundColor Yellow
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
python -m pip install -r "backend\requirements.txt"

Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
cmd /c npm install --prefix frontend

Write-Host "Installing root Prisma dependencies..." -ForegroundColor Cyan
npm install

$rootEnv = Get-Content ".env" -Raw
$backendEnv = Get-Content "backend\.env" -Raw

$databaseUrlReady = $rootEnv -notmatch "postgres:postgres@localhost:5432/odoo_pos_cafe"
$backendPasswordReady = $backendEnv -notmatch "DATABASE_PASSWORD=postgres"

if ($databaseUrlReady -and $backendPasswordReady) {
  Write-Host "Running Prisma generate..." -ForegroundColor Cyan
  npx prisma generate

  Write-Host "Running Prisma db push..." -ForegroundColor Cyan
  npx prisma db push

  Write-Host ""
  Write-Host "Setup complete." -ForegroundColor Green
  Write-Host "Start backend with: python -m uvicorn app.main:app --reload --app-dir backend"
  Write-Host "Start frontend with: cmd /c npm run dev --prefix frontend"
} else {
  Write-Host ""
  Write-Host "Dependencies are installed, but database setup is paused." -ForegroundColor Yellow
  Write-Host "1. Update .env DATABASE_URL"
  Write-Host "2. Update backend\.env DATABASE_PASSWORD"
  Write-Host "3. Run: npx prisma generate"
  Write-Host "4. Run: npx prisma db push"
}
