@echo off
REM Start the Next.js dev server for THIS project.
REM Uses the Node/npm on PATH instead of hardcoded absolute paths,
REM so it works on any machine and after the project is moved.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [dev.cmd] Node.js was not found on your PATH.
  echo Install Node 18+ from https://nodejs.org and try again.
  exit /b 1
)

call npm run dev %*