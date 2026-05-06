@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Glory Pharmacy Management System - Setup Utility
echo ========================================================
echo.

:: 1. Check for Node.js
echo [1/4] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
) else (
    echo [OK] Node.js is installed.
)

:: 2. Check for MySQL (via XAMPP usually)
echo [2/4] Checking for MySQL Service...
:: This is a simple check to see if port 3306 is listening
netstat -ano | findstr :3306 >nul
if %errorlevel% neq 0 (
    echo [WARNING] MySQL service (Port 3306) does not appear to be running.
    echo Please ensure XAMPP MySQL is started before proceeding.
    set /p "choice=Is MySQL running on a different port? (y/n): "
    if /i "!choice!" neq "y" (
        pause
        exit /b 1
    )
) else (
    echo [OK] MySQL service found.
)

:: 3. Install Dependencies
echo [3/4] Installing system dependencies...
echo This may take a few minutes...
call npm install
cd backend && call npm install
cd ../frontend && call npm install
cd ..

:: 4. Initialize Database
echo [4/4] Initializing Database...
cd backend
echo Running database seeder...
node seed.js
if %errorlevel% neq 0 (
    echo [ERROR] Failed to initialize database. Check your MySQL connection and credentials in backend/.env
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================================
echo   Setup Complete!
echo ========================================================
echo.
echo You can now build the application with:
echo   npm run electron:build
echo.
echo Or run it in development mode with:
echo   npm run electron:dev
echo.
pause
