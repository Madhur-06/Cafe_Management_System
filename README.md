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

1. Create a local PostgreSQL database named `odoo_pos_cafe`.
2. Copy `backend/.env.example` to `backend/.env` and update credentials if needed.
3. Install backend dependencies:
   `python -m pip install -r backend/requirements.txt`
4. Install frontend dependencies:
   `cmd /c npm install --prefix frontend`
5. Start backend:
   `python -m uvicorn app.main:app --reload --app-dir backend`
6. Start frontend:
   `cmd /c npm run dev --prefix frontend`

Demo credentials after first startup:

- Email: `admin@odoo-pos.local`
- Password: `admin123`
