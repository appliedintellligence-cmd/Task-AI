# task.ai

AI-powered home repair assistant for Australian homeowners. Upload a photo of any damage and get a step-by-step repair plan, materials list with AUD pricing, retailer links, and an AI-generated preview of the repaired surface.

## Features

- **Multi-stage vision pipeline** — OpenCV preprocessing → Groq vision → Nemotron repair reasoning
- **Repaired preview** — "Generate repaired preview" button on every result card (Replicate flux-schnell)
- **Text chat** — Multi-turn repair advice via Groq Llama 3.3 70B
- **Voice I/O** — Speak your question, hear the answer (Web Speech API, en-AU)
- **Retailer links** — Bunnings, Amazon AU, Mitre 10, Total Tools per material
- **Auth + history** — Supabase JWT auth, chat history, job history

## Vision Pipeline

| Stage | Component | Role |
|---|---|---|
| 1.5 | OpenCV | Crack detection, mould, water stain, blur, CLAHE enhance |
| 2 | Groq Llama 4 Scout 17B (base64) | Visual fact extraction |
| 3 | Nemotron 3 Nano :free (OpenRouter) | Chain-of-thought repair reasoning |
| 4 | Nemotron 3 Super :free (OpenRouter) | Retry on validation failure |
| Fallback | Groq Llama 4 Scout 17B | Direct vision → JSON if pipeline fails |

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | FastAPI (Python) + Uvicorn |
| Vision (Stage 2) | Groq — Llama 4 Scout 17B |
| Repair plan (Stage 3) | OpenRouter — Nemotron 3 Nano/Super (:free) |
| Chat | Groq — Llama 3.3 70B Versatile |
| Inpaint preview | Replicate — flux-schnell |
| Auth + DB + Storage | Supabase (PostgreSQL + pgvector + Storage) |
| Deploy | Vercel (frontend) + Render (backend) |

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_ keys
npm run dev
```

## Environment Variables

### Backend (Render)

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `REPLICATE_API_TOKEN` | [replicate.com/account](https://replicate.com/account) |
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API → service_role |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API |

### Frontend (Vercel)

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your Render backend URL (e.g. `https://taskai-backend.onrender.com`) |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |

## Supabase Setup

1. Create a new Supabase project
2. Run `db/schema.sql` in the SQL editor
3. Storage → New bucket → name: `repair-photos`, set to public
4. Authentication → Providers → enable Google OAuth

## Deploy

### Backend → Render

1. Connect GitHub repo to Render
2. Root directory: `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`
5. Add all env vars from the table above

### Frontend → Vercel

1. Connect GitHub repo to Vercel
2. Root directory: `frontend/`
3. Add `VITE_*` env vars in Vercel dashboard
4. Deploy

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyse` | Upload image → full repair result JSON |
| `POST` | `/chat` | Send message → repair advice |
| `POST` | `/inpaint` | Generate repaired preview image |
| `GET` | `/jobs` | List past repair jobs |
| `GET` | `/health` | Health check |
