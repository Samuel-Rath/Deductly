# 🚀 Quick Start - Run Locally

## Terminal Commands (Windows)

### Step 1: Open Terminal 1 - Start Backend

```powershell
cd C:\Users\samue\OneDrive\Documents\Deductly
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**You should see:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

✅ Backend is now running at: **http://localhost:8000**

---

### Step 2: Open Terminal 2 - Start Frontend

```powershell
cd C:\Users\samue\OneDrive\Documents\Deductly\frontend
npm install
npm run dev
```

**You should see:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

✅ Frontend is now running at: **http://localhost:5173**

---

### Step 3: Open Your Browser

Go to: **http://localhost:5173**

You should see the Tax Deduction Analyzer landing page!

---

## Quick Test

1. **Check Backend Health**: http://localhost:8000/health
2. **Check API Docs**: http://localhost:8000/docs
3. **Use the App**: http://localhost:5173

---

## Stop the Servers

- **Terminal 1 (Backend)**: Press `Ctrl + C`
- **Terminal 2 (Frontend)**: Press `Ctrl + C`

---

## Troubleshooting

### Backend won't start?
- Make sure you're in the project root directory
- Check Python is installed: `python --version`
- Reinstall dependencies: `pip install -r backend/requirements.txt`

### Frontend won't start?
- Check Node.js is installed: `node --version`
- Reinstall dependencies: `cd frontend && npm install`

### Can't access the app?
- Make sure both servers are running
- Check the URLs: Backend (8000), Frontend (5173)
- Try refreshing your browser

---

**That's it! You're ready to go! 🎉**
