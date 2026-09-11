@echo off
start "polar-mesh-api" python -m uvicorn app.main:app --app-dir backend --reload --port 8000
cd frontend
npm run dev
