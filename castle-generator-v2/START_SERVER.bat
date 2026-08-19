@echo off
title Castle Generator v2 Server
cd /d "%~dp0"
cls
echo =========================================================
echo   Castle Generator v2 - Dev Server
echo =========================================================
echo.
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)
echo   Local URL: http://localhost:3005/
echo.
echo   Press Ctrl+C anytime to stop the server.
echo =========================================================
echo.
npm run dev
pause
