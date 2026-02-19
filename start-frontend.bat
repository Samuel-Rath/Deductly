@echo off
echo =========================================
echo Starting Tax Deduction Analyzer Frontend
echo =========================================
echo.

cd frontend

echo Checking Node.js installation...
node --version
npm --version
echo.

echo Installing/updating dependencies...
call npm install
echo.

echo Starting frontend dev server...
echo Frontend will be available at: http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev
