@echo off
title Gesture Earth Demo

echo ================================
echo   Gesture Earth Demo
echo ================================
echo.

:: ---- Backend ----
netstat -ano | findstr ":8000.*LISTENING" >nul
if %errorlevel% neq 0 (
    echo [1/3] Installing Python dependencies...
    pip install -r backend\requirements.txt -q 2>nul
    echo [2/3] Starting API backend on port 8000...
    start "GestureEarth-API" cmd /c "cd /d %~dp0backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [INFO] Backend port 8000 already in use, skip start.
)

:: ---- Frontend ----
netstat -ano | findstr ":8082.*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [INFO] Frontend port 8082 already in use, opening browser...
    start http://localhost:8082
    exit /b
)

echo [3/3] Starting frontend on port 8082...
echo Opening http://localhost:8082
echo Close this window to stop the servers.
echo ================================
echo.

start http://localhost:8082
npx http-server . -p 8082 -c-1
pause
