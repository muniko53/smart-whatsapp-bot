@echo off
title Smart WhatsApp Sales Assistant - Server
color 0A
echo ============================================
echo  Smart WhatsApp Sales Assistant
echo  Dashboard API Server
echo ============================================
echo.

cd /d "%~dp0"

REM ── Set your PostgreSQL connection string here (or in .env) ──
REM Never commit real credentials.
set DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require

REM ── Groq API key for voice note transcription ────────────────
REM Get your free key at: https://console.groq.com
set GROQ_API_KEY=YOUR_GROQ_KEY_HERE

echo Starting server on http://localhost:5002
echo Keep this window open while using the dashboard.
echo Close this window to stop the server.
echo.
python dashboard_api.py
pause
