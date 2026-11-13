@echo off
title BrandGuard AI - Multi-Device Launcher
echo ===================================================
echo        BrandGuard AI Multi-Device Service Launcher
echo ===================================================
echo.

:: Detect Host LAN IP address
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0.*0.0.0.0"') do (
    set HOST_IP=%%a
)

echo Detected Host LAN IP Address: %HOST_IP%
echo.
echo Starting services configured to listen on 0.0.0.0 (all network interfaces)...
echo.

:: 1. Start Python FastAPI AI Service
echo [1/3] Starting AI Service on port 8000...
start "BrandGuard AI - AI Service (8000)" cmd /k "cd /d %~dp0\..\ai-service && if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 2. Start Node.js Express Backend
echo [2/3] Starting Backend on port 5000...
start "BrandGuard AI - Backend (5000)" cmd /k "cd /d %~dp0\..\backend && npm run dev"

:: 3. Start Vite React Frontend
echo [3/3] Starting Frontend on port 5173...
start "BrandGuard AI - Frontend (5173)" cmd /k "cd /d %~dp0\..\frontend && npm run dev"

echo.
echo ===================================================
echo All services have been launched in separate windows!
echo.
echo ACCESS URLS:
echo   Local Laptop:  http://localhost:5173
echo   Other Laptops: http://%HOST_IP%:5173
echo.
echo Backend API:     http://%HOST_IP%:5000
echo AI Service:      http://%HOST_IP%:8000
echo ===================================================
echo.
pause
