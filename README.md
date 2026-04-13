# task.ai

AI-powered home repair assistant. Upload a photo of any repair issue and get step-by-step instructions, materials list with AUD pricing, and direct links to Bunnings, Amazon AU, and Mitre 10.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS v4 |
| Backend | FastAPI (Python) |
| AI | Google Gemini 2.0 Flash |
| Auth + DB | Supabase (Google OAuth, PostgreSQL, Storage) |
| Deploy | Vercel (frontend) + Render (backend) |

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in your keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local   # fill in VITE_ keys
npm run dev
```

## Environment variables

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API → service_role |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |
| `VITE_API_URL` | Your Render backend URL (e.g. `https://taskai-backend.onrender.com`) |

## Supabase setup

1. Create a new Supabase project
2. Run `db/schema.sql` in the SQL editor
3. Go to Storage → New bucket → name: `repair-photos`, public: off
4. Go to Authentication → Providers → enable Google OAuth (add your Google OAuth client ID + secret)

## Deploy

### Frontend → Vercel

```bash
cd frontend
npm run build
# Push to GitHub and connect repo to Vercel
# Set VITE_* env vars in Vercel dashboard
```

### Backend → Render

1. Connect GitHub repo to Render
2. Set root directory to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`
5. Add all env vars (GEMINI_API_KEY, SUPABASE_*)
