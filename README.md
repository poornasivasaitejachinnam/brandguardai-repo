# BrandGuard AI

BrandGuard AI is an enterprise-ready brand governance platform built with React, Express, MySQL and a FastAPI AI compliance service.

## Stack
- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express + MySQL
- AI: Python FastAPI

## Folder structure
- frontend/
- backend/
- ai-service/
- database/
- docs/

## Run the app (Windows CMD)

Terminal 1 - Frontend:
```cmd
cd /d C:\BrandGuardAI\frontend
npm run dev
```

Terminal 2 - Backend:
```cmd
cd /d C:\BrandGuardAI\backend
npm run dev
```

Terminal 3 - AI Service:
```cmd
cd /d C:\BrandGuardAI\ai-service
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

## Environment files
Copy `.env.example` files and provide actual credentials before running against a real MySQL instance.

If the database has no active administrator, create the first one from an interactive Command Prompt:

```cmd
cd /d C:\BrandGuardAI\backend
npm run bootstrap:admin
```

The command prompts for name, email, and a hidden password. It refuses to run if an active administrator already exists and stores only a bcrypt password hash.

## Notes
- The backend connects to MySQL via environment variables.
- Signed-in users can update their profile and change their password from Settings.
- The AI service uses a transparent, rule-based compliance engine when no external AI model is configured.
- If MySQL credentials are missing or invalid, database-backed routes return an explicit configuration/connection error; no sample records are presented as live data.
- For a short live workflow check, run `npm run test:workflow` in `backend` while the backend and AI service are running. It creates temporary records and removes only those records when finished.
