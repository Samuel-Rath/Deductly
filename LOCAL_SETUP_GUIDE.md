# Local Setup Guide - Windows

Quick guide to run the Tax Deduction Analyzer on your local Windows machine.

---

## Prerequisites

You already have:
- ✅ Python 3.13 installed
- ✅ Node.js and npm installed
- ✅ Git installed

---

## Quick Start (5 minutes)

### Step 1: Start the Backend (Terminal 1)

Open a terminal in the project root and run:

```powershell
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start the backend server
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Backend is now running at: http://localhost:8000**

### Step 2: Start the Frontend (Terminal 2)

Open a **new terminal** in the project root and run:

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start the frontend dev server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Frontend is now running at: http://localhost:5173**

### Step 3: Open the Application

Open your browser and go to:
```
http://localhost:5173
```

You should see the Tax Deduction Analyzer landing page!

---

## Testing the Application

### Upload a Test CSV

1. Go to http://localhost:5173
2. Click "Get Started" or "Upload CSV"
3. Upload a CSV file with bank transactions
4. View the generated report with deduction candidates

### Sample CSV Format

Create a test file `test_transactions.csv`:

```csv
Date,Description,Amount
2024-01-15,OFFICEWORKS SYDNEY,-45.50
2024-01-20,UBER TRIP TO CLIENT,-32.00
2024-01-25,SALARY DEPOSIT,5000.00
2024-02-01,BUNNINGS WAREHOUSE,-120.00
2024-02-10,WOOLWORTHS GROCERIES,-85.30
```

---

## Verify Everything is Working

### Check Backend Health

Open: http://localhost:8000/health

You should see:
```json
{
  "status": "healthy",
  "checks": { ... },
  "metrics": { ... }
}
```

### Check API Documentation

Open: http://localhost:8000/docs

You should see the interactive API documentation (Swagger UI).

### Check Frontend

Open: http://localhost:5173

You should see the landing page with:
- Hero section
- "How it works" section
- Upload button

---

## Common Issues and Solutions

### Issue 1: Backend Port Already in Use

**Error**: `Address already in use`

**Solution**: Use a different port
```powershell
python -m uvicorn backend.main:app --reload --port 8001
```

Then update frontend to use new port (see Issue 3).

### Issue 2: Frontend Port Already in Use

**Error**: `Port 5173 is already in use`

**Solution**: Vite will automatically try the next available port (5174, 5175, etc.)

### Issue 3: Frontend Can't Connect to Backend

**Error**: Network errors in browser console

**Solution**: Check the API URL in `frontend/src/api/client.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

Or set environment variable:
```powershell
# In frontend directory
echo VITE_API_BASE_URL=http://localhost:8000 > .env.local
```

### Issue 4: Module Not Found Errors

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**: Install backend dependencies
```powershell
cd backend
pip install -r requirements.txt
```

**Error**: `Cannot find module 'react'`

**Solution**: Install frontend dependencies
```powershell
cd frontend
npm install
```

### Issue 5: Python Virtual Environment

If you want to use a virtual environment (recommended):

```powershell
# Create virtual environment
cd backend
python -m venv venv

# Activate it
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn backend.main:app --reload
```

---

## Development Tips

### Hot Reload

Both servers support hot reload:
- **Backend**: Automatically reloads when you change Python files
- **Frontend**: Automatically reloads when you change React files

### View Logs

**Backend logs**: Displayed in Terminal 1 (structured JSON format)

**Frontend logs**: Open browser DevTools (F12) → Console tab

### API Testing

Use the interactive API docs at http://localhost:8000/docs to:
- Test API endpoints
- View request/response schemas
- Try different parameters

### Database

By default, the app runs in **ephemeral mode** (no database):
- Files are processed in memory
- Reports are generated and stored temporarily
- No persistent data storage

To enable persistent mode, set in backend:
```powershell
$env:EPHEMERAL_MODE="false"
python -m uvicorn backend.main:app --reload
```

---

## Stopping the Application

### Stop Backend
In Terminal 1, press: `Ctrl + C`

### Stop Frontend
In Terminal 2, press: `Ctrl + C`

---

## Running Tests

### Backend Tests
```powershell
cd backend
pytest
```

### Frontend Tests
```powershell
cd frontend
npm test
```

---

## Next Steps

### For Development
- Edit files and see changes automatically
- Check `README.md` for detailed documentation
- Review `SECURITY.md` for security guidelines

### For Deployment
- See `DEPLOYMENT.md` for production deployment
- See `DEPLOYMENT_READY_SUMMARY.md` for deployment checklist

---

## Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main application UI |
| Backend API | http://localhost:8000 | REST API |
| API Docs | http://localhost:8000/docs | Interactive API documentation |
| Health Check | http://localhost:8000/health | System health status |
| Metrics | http://localhost:8000/metrics | Application metrics |

---

## Need Help?

1. Check the logs in both terminals
2. Verify both servers are running
3. Check browser console for errors (F12)
4. Review `README.md` for detailed setup
5. Check `DEPLOYMENT.md` for troubleshooting

---

**Happy coding! 🚀**
