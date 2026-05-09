@echo off
title Gesture Earth Demo

netstat -ano | findstr ":8082.*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [INFO] Port 8082 already in use, opening browser...
    start http://localhost:8082
    exit /b
)

echo ================================
echo   Gesture Earth Demo
echo ================================
echo.
echo Starting http-server on port 8082...
echo Opening http://localhost:8082
echo Close this window to stop the server.
echo ================================
echo.

start http://localhost:8082
npx http-server . -p 8082 -c-1
pause
