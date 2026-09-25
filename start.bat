@echo off
title Smart WhatsApp Bot - Startup

REM Local dev only — put the real value in .env (never commit secrets).
set DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require

echo Starting Combined Server (webhook + dashboard API, port 5001)...
start "WhatsApp Bot" cmd /k "set DATABASE_URL=%DATABASE_URL% && cd /d %~dp0 && python main.py"

echo Starting Frontend (port 3001)...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo All servers starting...
echo   Combined Server: http://localhost:5001 ^(webhook + /api/*^)
echo   Frontend       : http://localhost:3001
echo.
echo Close this window anytime - servers run in their own windows.
pause
