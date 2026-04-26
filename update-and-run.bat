@echo off
REM ============================================================
REM SRB — One-click updater + launcher for Windows
REM Double-click this file to:
REM   1. Pull the latest changes from GitHub
REM   2. Install any new dependencies
REM   3. Push schema changes to the local SQLite DB
REM   4. Start the dev server on http://localhost:3000
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  SRB System — Update and Launch
echo ============================================================
echo.
echo  Working directory: %CD%
echo.

REM --- 1. Pull latest changes ---------------------------------
echo [1/4] Pulling latest changes from GitHub...
git fetch origin
if errorlevel 1 (
    echo.
    echo  Git fetch failed. Check your internet connection.
    pause
    exit /b 1
)

REM Default to the audit branch unless the user is already on a different one.
git rev-parse --abbrev-ref HEAD > "%TEMP%\srb_branch.txt"
set /p CURRENT_BRANCH=<"%TEMP%\srb_branch.txt"
del "%TEMP%\srb_branch.txt"

if "%CURRENT_BRANCH%"=="main" (
    echo  Switching from main to claude/audit-internal-system-jQ6er...
    git checkout claude/audit-internal-system-jQ6er
)

git pull --ff-only origin claude/audit-internal-system-jQ6er
if errorlevel 1 (
    echo.
    echo  Git pull failed. If you have local changes, commit or stash them first.
    pause
    exit /b 1
)

echo.

REM --- 2. Install dependencies --------------------------------
echo [2/4] Installing dependencies (this may take 1-2 minutes)...
call npm install
if errorlevel 1 (
    echo.
    echo  npm install failed. Make sure Node.js 20+ is installed.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)

echo.

REM --- 3. Sync the SQLite schema (Notification + Task reminders) -
echo [3/4] Syncing database schema...
call npx prisma db push --skip-generate
if errorlevel 1 (
    echo.
    echo  Prisma db push failed. Check that .env.local has DATABASE_URL set.
    pause
    exit /b 1
)

echo.

REM --- 4. Start the dev server --------------------------------
echo [4/4] Starting dev server on http://localhost:3000 ...
echo.
echo  ============================================================
echo   System is starting. Open http://localhost:3000 in Chrome.
echo   To stop the server, press Ctrl+C in this window.
echo  ============================================================
echo.

call npm run dev
