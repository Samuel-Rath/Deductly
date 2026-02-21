@echo off
echo ========================================
echo Starting Tax Deduction Analyzer Backend
echo ========================================
echo.

echo Checking Python installation...
python --version
echo.

echo Installing/updating dependencies...
cd backend
pip install -r requirements.txt
cd ..
echo.

echo Starting backend server...
echo Backend will be available at: http://localhost:8000
echo API Documentation at: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
