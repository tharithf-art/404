@echo off
REM ===== EcoRoute one-click start =====
REM Opens two windows: the Python backend (port 8000) and the React frontend.
REM Close those two windows to stop the app.

set ROOT=%~dp0

echo Starting EcoRoute backend...
start "EcoRoute BACKEND (keep open)" cmd /k "cd /d "%ROOT%backend" && python -m pip install -q -r requirements.txt && python -m uvicorn app.main:app --port 8000"

echo Starting EcoRoute frontend...
start "EcoRoute FRONTEND (keep open)" cmd /k "cd /d "%ROOT%frontend" && (if not exist node_modules npm install) & npm run dev -- --open"

echo.
echo Two windows have opened. The browser will open automatically in a few seconds.
echo To stop EcoRoute, close both windows.
timeout /t 8 >nul
