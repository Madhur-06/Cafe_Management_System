# Odoo POS Cafe

Full-stack restaurant POS built from the hackathon brief.

## Stack

- Frontend: Node.js + React + Vite
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL (local)

## Structure

- `frontend` React application for POS, kitchen, customer display, reporting, and backend config
- `backend` FastAPI API with auth, sessions, orders, kitchen, payment, and reporting

## Local setup

Simplest Windows setup:

1. Create the local PostgreSQL database:
   `createdb -U postgres odoo_pos_cafe`
2. Run:
   `powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1`
3. Update `.env` and `backend/.env` with your PostgreSQL password.
4. Start backend:
   `python -m uvicorn app.main:app --reload --app-dir backend`
5. Start frontend:
   `cmd /c npm run dev --prefix`

Manual setup is still available if you prefer:

1. Copy `backend/.env.example` to `backend/.env` and update credentials if needed.
2. Copy `.env.example` to `.env` and update `DATABASE_URL`.
3. Install backend dependencies:
   `python -m pip install -r backend/requirements.txt`
4. Install frontend dependencies:
   `cmd /c npm install --prefix`
5. Install root Prisma dependencies:
   `npm install`
6. Run Prisma:
   `npx prisma generate`
   `npx prisma db push`

