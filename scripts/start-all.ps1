# BrandGuard AI PowerShell Service Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "    BrandGuard AI Multi-Device Service Launcher     " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = Split-Path -Parent $PSScriptRoot

# Detect active LAN IPv4 address
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and 
    $_.IPAddress -notmatch '^(127\.|169\.254\.)' 
} | Select-Object -First 1).IPAddress

if (-not $ipAddress) {
    $ipAddress = "localhost"
}

Write-Host "Detected Host LAN IP Address: $ipAddress" -ForegroundColor Green
Write-Host ""
Write-Host "Launching services on 0.0.0.0..." -ForegroundColor Yellow

# 1. Start AI Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootPath\ai-service'; if (Test-Path .venv\Scripts\Activate.ps1) { .\.venv\Scripts\Activate.ps1 }; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# 2. Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootPath\backend'; npm run dev"

# 3. Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootPath\frontend'; npm run dev"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "All services launched in separate windows!" -ForegroundColor Green
Write-Host "Local Laptop:  http://localhost:5173"
Write-Host "Other Laptops: http://${ipAddress}:5173"
Write-Host "Backend API:   http://${ipAddress}:5000"
Write-Host "AI Service:    http://${ipAddress}:8000"
Write-Host "===================================================" -ForegroundColor Cyan
