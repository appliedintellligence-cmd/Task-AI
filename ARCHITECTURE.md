# task.ai — System Architecture

> AI-Powered Home Repair Assistant for Australian Homeowners
> **Version** 1.2 · **Last updated** May 2026

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [AI & LLM Inference Architecture](#2-ai--llm-inference-architecture)
3. [Vision Pathway — Image Analysis](#3-vision-pathway--image-analysis)
4. [Text Chat Pathway](#4-text-chat-pathway)
5. [Inpaint Repaired Preview](#5-inpaint-repaired-preview)
6. [Database Schema](#6-database-schema)
7. [Voice I/O Pipeline](#7-voice-io-pipeline)
8. [Retailer Link Generation](#8-retailer-link-generation)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Technology Stack](#10-technology-stack)

---

## 1. High-Level System Architecture

```mermaid
flowchart LR
    classDef fe     fill:#1E40AF,stroke:#1E3A8A,color:#fff
    classDef voice  fill:#BE185D,stroke:#9D174D,color:#fff
    classDef be     fill:#065F46,stroke:#064E3B,color:#fff
    classDef ai     fill:#6D28D9,stroke:#5B21B6,color:#fff
    classDef db     fill:#92400E,stroke:#78350F,color:#fff
    classDef retail fill:#0369A1,stroke:#075985,color:#fff
    classDef cv     fill:#374151,stroke:#1F2937,color:#fff

    subgraph FE["🖥  Frontend · React 18 + Vite + Tailwind v4"]
        CP[ChatPage]:::fe
        CI[ChatInput]:::fe
        CM[ChatMessage]:::fe
        CS[ChatSidebar]:::fe
        RL[RetailerLinks]:::retail
        UV["useVoice · STT"]:::voice
        US["useSpeech · TTS"]:::voice
        UC[useChat]:::fe
    end

    subgraph BE["⚙  Backend · FastAPI + Uvicorn · Render"]
        RA["POST /analyse"]:::be
        RC["POST /chat"]:::be
        RI["POST /inpaint"]:::be
        RJ["GET /jobs"]:::be
        OCV["opencv_metrics.py"]:::cv
        ORS["openrouter.py"]:::be
        VAL["validator.py"]:::be
        GEM["gemini.py (Groq)"]:::be
        RET["retailers.py"]:::retail
        SUP["supabase.py"]:::be
    end

    subgraph AI_SVC["🤖  AI Services"]
        GR["Groq Cloud<br/>Llama 4 Scout 17B · vision<br/>Llama 3.3 70B · chat"]:::ai
        OR["OpenRouter<br/>Nemotron 3 Nano/Super · free"]:::ai
        REP["Replicate<br/>flux-schnell · inpaint"]:::ai
    end

    subgraph SUPA["🗄  Supabase"]
        PG[("PostgreSQL<br/>+ pgvector")]:::db
        STO[("Storage<br/>images")]:::db
        AUTH[("Auth<br/>JWT")]:::db
    end

    FE -->|"POST /analyse · FormData"| RA
    FE -->|"POST /chat · JSON"| RC
    FE -->|"POST /inpaint · JSON"| RI
    RA --> OCV
    RA --> ORS
    RA --> VAL
    RA --> GEM
    RC --> GEM
    RI -->|"flux-schnell"| REP
    ORS -->|"Stage 2 vision (base64)"| GR
    ORS -->|"Stage 3 CoT plan"| OR
    GEM -->|"vision fallback (base64)"| GR
    GEM -->|"chat inference"| GR
    SUP --> PG
    RA -->|"upload enhanced image"| STO
    FE <-->|"Bearer JWT"| AUTH
```

---

## 2. AI & LLM Inference Architecture

All inference runs on **Groq** (free) and **OpenRouter** (Nemotron free tier). Google Gemini is not used.

```mermaid
flowchart TD
    classDef model   fill:#6D28D9,stroke:#5B21B6,color:#fff
    classDef engine  fill:#1E40AF,stroke:#1E3A8A,color:#fff
    classDef sdk     fill:#065F46,stroke:#064E3B,color:#fff
    classDef output  fill:#92400E,stroke:#78350F,color:#fff
    classDef task    fill:#374151,stroke:#1F2937,color:#fff

    subgraph GROQ_VIS["Groq · Vision Facts (Stage 2)"]
        M1["Llama 4 Scout 17B-16E<br/>(MoE Instruct)"]:::model
        T1["Task: Visual fact extraction<br/>Base64 image — no URL fetch<br/>Objective observations only"]:::task
        SDK1["groq Python SDK<br/>chat.completions.create()"]:::sdk
        OUT1["Output: Structured JSON<br/>surface_material / damage_types<br/>moisture_visible / grout_condition"]:::output
        M1 --> T1 --> SDK1 --> OUT1
    end

    subgraph OR_PLAN["OpenRouter · CoT Repair Plan (Stage 3 + 4)"]
        M2["Nemotron 3 Nano 30B :free<br/>(primary)"]:::model
        M2S["Nemotron 3 Super 120B :free<br/>(retry on validation fail)"]:::model
        T2["Task: Chain-of-thought<br/>repair reasoning"]:::task
        SDK2["httpx.AsyncClient<br/>OpenAI-compatible REST<br/>openrouter.ai/api/v1"]:::sdk
        OUT2["Output: Structured JSON<br/>confidence / problem / severity<br/>steps / materials / tools<br/>root_cause / inpaint_prompt"]:::output
        M2 --> T2
        M2S --> T2
        T2 --> SDK2 --> OUT2
    end

    subgraph GROQ_CHAT["Groq · Text Chat"]
        M3["Llama 3.3 70B Versatile"]:::model
        T3["Task: Multi-turn repair advice<br/>temperature=0.3"]:::task
        SDK3["groq Python SDK<br/>chat.completions.create()"]:::sdk
        OUT3["Output: Markdown +<br/>embedded XML materials tag"]:::output
        M3 --> T3 --> SDK3 --> OUT3
    end

    subgraph GROQ_FB["Groq · Vision Fallback"]
        M4["Llama 4 Scout 17B-16E"]:::model
        T4["Task: Direct vision → JSON<br/>Used when Stage 2-3 pipeline fails"]:::task
        SDK4["groq Python SDK<br/>chat.completions.create()"]:::sdk
        OUT4["Output: Structured JSON<br/>problem / steps / materials<br/>safety_notes / severity"]:::output
        M4 --> T4 --> SDK4 --> OUT4
    end

    subgraph REPLICATE["Replicate · Inpaint Preview"]
        M5["flux-schnell<br/>black-forest-labs"]:::model
        T5["Task: Text-to-image<br/>photorealistic repaired surface"]:::task
        SDK5["replicate Python SDK<br/>async_run()"]:::sdk
        OUT5["Output: WebP image URL<br/>1:1 aspect, 4 steps"]:::output
        M5 --> T5 --> SDK5 --> OUT5
    end
```

### Model Summary

| | Llama 4 Scout (Stage 2) | Nemotron Nano/Super (Stage 3/4) | Llama 3.3 70B (Chat) | Llama 4 Scout (Fallback) | flux-schnell (Inpaint) |
|---|---|---|---|---|---|
| **Provider** | Groq | OpenRouter | Groq | Groq | Replicate |
| **Role** | Vision fact extraction | CoT repair plan | Text chat | Pipeline fallback | Repaired preview |
| **Input** | Base64 image + metrics | JSON facts + metrics | Multi-turn messages | Base64 image | Text prompt |
| **Output** | Facts JSON | Plan JSON | Markdown + XML | Repair JSON | WebP image URL |
| **Cost** | Free | Free (`:free` models) | Free | Free | Pay per run |

---

## 3. Vision Pathway — Image Analysis

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend<br/>(React)
    participant BE as Backend<br/>(FastAPI)
    participant OCV as opencv_metrics.py<br/>(Stage 1.5)
    participant SB as Supabase<br/>(Storage)
    participant GR2 as Groq<br/>Llama 4 Scout<br/>(Stage 2)
    participant NE as OpenRouter<br/>Nemotron Nano/Super<br/>(Stage 3-4)
    participant GRF as Groq<br/>Llama 4 Scout<br/>(Fallback)

    User->>FE: Select repair photo
    FE->>BE: POST /analyse (FormData file)
    activate BE

    BE->>OCV: extract_metrics(image_bytes)<br/>resize to max 1024px, CLAHE enhance<br/>crack/mould/water/blur detection
    OCV-->>BE: cv_metrics + enhanced_bytes<br/>explicit del of intermediate arrays

    BE->>SB: upload_image(enhanced_bytes)
    SB-->>BE: image_url (public URL)

    alt GROQ_API_KEY set
        BE->>GR2: extract_facts_qwen(upload_bytes, metrics_context)<br/>model: llama-4-scout-17b-16e-instruct<br/>image sent as base64 data URL
        GR2-->>BE: facts JSON<br/>(surface_material, damage_types, …)

        BE->>BE: validate_facts(facts)

        BE->>NE: generate_repair_plan_nemotron(facts, metrics_context)<br/>model: nemotron-3-nano-30b-a3b:free
        NE-->>BE: plan JSON<br/>(confidence, problem, steps, materials, inpaint_prompt, …)

        BE->>BE: validate_plan(plan)

        alt plan invalid
            BE->>NE: retry with nemotron-3-super-120b-a12b:free
            NE-->>BE: plan JSON (retry)
        end

        BE->>BE: merge facts + plan<br/>pipeline = "opencv-qwen-nemotron"
    else pipeline fails
        BE->>GRF: analyse_image(image_bytes)<br/>model: llama-4-scout-17b-16e-instruct<br/>base64 image + CoT JSON schema prompt
        GRF-->>BE: Repair JSON<br/>pipeline = "gemini-fallback"
    end

    BE-->>FE: result JSON<br/>(problem / severity / steps / materials<br/>safety_notes / difficulty / tools_required<br/>opencv_metrics / confidence_level / pipeline<br/>image_url / inpaint_prompt)
    deactivate BE

    FE-->>User: RepairResult card<br/>(steps / materials / safety / confidence badge<br/>+ Generate repaired preview button)
```

---

## 4. Text Chat Pathway

RAG embeddings are currently disabled (stubbed). Chat calls Groq directly on every message.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend<br/>(React)
    participant BE as Backend<br/>(FastAPI)
    participant GR as Groq<br/>Llama 3.3 70B

    User->>FE: Type repair question
    FE->>BE: POST /chat {message, chat_id, user_id}<br/>Authorization: Bearer JWT
    activate BE

    BE->>BE: verify_token(JWT) → user_id
    BE->>BE: create_chat() if new session
    BE->>BE: save_message(user)
    BE->>BE: get_messages(chat_id) → history

    BE->>GR: chat_reply(history)<br/>system: SYSTEM_PROMPT + materials instruction<br/>model: llama-3.3-70b-versatile<br/>temperature=0.3, max_tokens=2048
    GR-->>BE: Markdown + materials XML tag

    BE->>BE: _extract_materials(reply)<br/>regex strip XML tags<br/>generate_links(name) per material
    BE->>BE: save_message(assistant, clean_reply)

    BE-->>FE: {reply, materials[], chat_id, cached: false}
    deactivate BE

    FE-->>User: ReactMarkdown rendered reply<br/>+ MaterialsSection with retailer links
```

---

## 5. Inpaint Repaired Preview

Triggered on demand by the "Generate repaired preview" button on each repair result card. Uses the `inpaint_prompt` field returned by Nemotron.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend<br/>(React)
    participant BE as Backend<br/>(FastAPI)
    participant REP as Replicate<br/>flux-schnell

    User->>FE: Click "✨ Generate repaired preview"
    FE->>BE: POST /inpaint {inpaint_prompt}
    activate BE

    BE->>REP: async_run("black-forest-labs/flux-schnell")<br/>prompt: inpaint_prompt<br/>num_outputs: 1, aspect_ratio: "1:1"<br/>output_format: "webp", steps: 4
    REP-->>BE: [image_url]  (~5-10s)

    BE-->>FE: {repaired_image_url}
    deactivate BE

    FE-->>User: Repaired image displayed below<br/>original damage photo<br/>"AI repaired preview" label
```

---

## 6. Database Schema

```mermaid
erDiagram
    USERS {
        uuid        id          PK
        text        email
        timestamptz created_at
    }

    PROFILES {
        uuid        id          PK
        text        first_name
        text        last_name
        text        phone
        timestamptz created_at
    }

    CHATS {
        uuid        id          PK
        uuid        user_id     FK
        text        title
        timestamptz created_at
        timestamptz updated_at
    }

    MESSAGES {
        uuid        id          PK
        uuid        chat_id     FK
        text        role
        text        content
        text        image_url
        jsonb       result_json
        vector      embedding
        timestamptz created_at
    }

    JOBS {
        uuid        id          PK
        uuid        user_id     FK
        text        image_url
        text        problem
        text        severity
        text        difficulty
        jsonb       result_json
        vector      embedding
        timestamptz created_at
    }

    USERS ||--o| PROFILES   : "has"
    USERS ||--o{ CHATS      : "owns"
    CHATS ||--o{ MESSAGES   : "contains"
    USERS ||--o{ JOBS       : "owns"
```

> **pgvector config:**
>
> `messages.embedding vector(3072)` — reserved for future RAG (currently null, embeddings disabled)
> `jobs.embedding vector(768)` — reserved for future job similarity (currently null)
>
> RLS: users access only their own rows in `chats`, `messages`, `jobs`, `profiles`
> Auto-trigger: `handle_new_user()` creates a `profiles` row on every new auth signup

---

## 7. Voice I/O Pipeline

```mermaid
flowchart LR
    classDef browser fill:#BE185D,stroke:#9D174D,color:#fff
    classDef fe      fill:#1E40AF,stroke:#1E3A8A,color:#fff
    classDef setting fill:#374151,stroke:#1F2937,color:#fff

    subgraph STT["🎙  Voice Input · useVoice.js"]
        direction TB
        MIC["User taps mic button"]:::fe
        SR["SpeechRecognition<br/>continuous=true<br/>interimResults=true<br/>lang=en-AU"]:::browser
        TR["Live transcript<br/>streamed to textarea"]:::fe
        SIL{"2s silence<br/>timeout"}:::setting
        AUTO{"taskai_autosubmit<br/>localStorage"}:::setting
        SUB["handleSend(transcript)<br/>SpeechRecognition.stop()"]:::fe

        MIC --> SR --> TR --> SIL
        SIL -->|"yes"| AUTO
        AUTO -->|"enabled"| SUB
        AUTO -->|"disabled"| TR
    end

    subgraph TTS["🔊  Voice Output · useSpeech.js"]
        direction TB
        NEW["New AI reply received"]:::fe
        AR{"taskai_autoread<br/>localStorage"}:::setting
        SM["stripMarkdown(text)<br/>remove ** ## backticks links"]:::fe
        UTT["SpeechSynthesisUtterance<br/>lang=en-AU"]:::browser
        EM["module-level EventTarget<br/>shared speakingId<br/>(one speaker at a time)"]:::fe
        SPK["SpeakerButton<br/>toggle speak / stop"]:::fe

        NEW --> AR
        AR -->|"enabled"| SM
        SPK -->|"user click"| SM
        SM --> UTT --> EM
    end
```

---

## 8. Retailer Link Generation

```mermaid
flowchart LR
    classDef mat    fill:#374151,stroke:#1F2937,color:#fff
    classDef link   fill:#0369A1,stroke:#075985,color:#fff
    classDef fe     fill:#1E40AF,stroke:#1E3A8A,color:#fff

    M["material name<br/>(from XML tags in LLM reply)"]:::mat

    BU["Bunnings<br/>bunnings.com.au/search/results?q=…"]:::link
    AM["Amazon AU<br/>amazon.com.au/s?k=…"]:::link
    MI["Mitre 10<br/>mitre10.com.au/search?q=…"]:::link
    TT["Total Tools<br/>totaltools.com.au/search?q=…"]:::link

    UI["MaterialsSection.jsx<br/>per-material card<br/>name · qty · cost<br/>+ retailer buttons"]:::fe

    M -->|"quote_plus(name)"| BU
    M -->|"quote_plus(name)"| AM
    M -->|"quote_plus(name)"| MI
    M -->|"quote_plus(name)"| TT
    BU --> UI
    AM --> UI
    MI --> UI
    TT --> UI
```

---

## 9. Deployment Architecture

```mermaid
flowchart TD
    classDef git    fill:#374151,stroke:#1F2937,color:#fff
    classDef render fill:#065F46,stroke:#064E3B,color:#fff
    classDef cdn    fill:#1E40AF,stroke:#1E3A8A,color:#fff
    classDef ext    fill:#6D28D9,stroke:#5B21B6,color:#fff
    classDef db     fill:#92400E,stroke:#78350F,color:#fff
    classDef secret fill:#BE185D,stroke:#9D174D,color:#fff

    GH["GitHub<br/>main branch → auto-deploy"]:::git

    GH -->|"backend/"| RENDER
    GH -->|"frontend/"| VERCEL

    subgraph RENDER["Render · Backend (512MB free tier)"]
        R1["Python · Uvicorn<br/>FastAPI app"]:::render
        R2["Env Secrets"]:::secret
        R2 -->|"GROQ_API_KEY<br/>OPENROUTER_API_KEY<br/>REPLICATE_API_TOKEN<br/>SUPABASE_URL<br/>SUPABASE_SERVICE_KEY<br/>SUPABASE_ANON_KEY"| R1
    end

    subgraph VERCEL["Vercel / CDN · Frontend"]
        V1["React SPA<br/>Vite build → static"]:::cdn
        V2["Env Vars"]:::secret
        V2 -->|"VITE_API_URL<br/>VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY"| V1
    end

    R1 -->|"Stage 2: vision (base64)"| GR["Groq Cloud<br/>Llama 4 Scout 17B"]:::ext
    R1 -->|"Stage 3: CoT plan (free)"| OR["OpenRouter<br/>Nemotron 3 Nano/Super :free"]:::ext
    R1 -->|"Chat inference"| GR
    R1 -->|"Inpaint preview"| REP["Replicate<br/>flux-schnell"]:::ext
    R1 -->|"DB + Storage + Auth"| SB["Supabase<br/>PostgreSQL + pgvector<br/>Storage + Auth"]:::db
    V1 -->|"Bearer JWT"| SB
```

---

## 10. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend framework** | React 18 | SPA, hooks-based |
| **Build tool** | Vite 5.4 | HMR, tree-shaking |
| **Styling** | Tailwind CSS v4 | No `tailwind.config.js` — `@plugin` in CSS |
| **Markdown** | react-markdown + remark-gfm | GFM tables, code blocks |
| **Auth client** | @supabase/supabase-js 2.x | JWT session management |
| **Backend** | FastAPI + Uvicorn | Async, Pydantic v2 |
| **Vision Stage 2** | Llama 4 Scout 17B-16E (Groq) | Base64 image input, visual fact extraction |
| **Vision Stage 3** | Nemotron 3 Nano 30B (OpenRouter :free) | CoT repair reasoning, JSON output |
| **Vision Stage 4** | Nemotron 3 Super 120B (OpenRouter :free) | Retry model on validation failure |
| **Vision Fallback** | Llama 4 Scout 17B-16E (Groq) | Direct image → JSON if pipeline fails |
| **LLM — chat** | Llama 3.3 70B Versatile (Groq) | Multi-turn, temperature=0.3 |
| **LLM — embeddings** | Disabled | Stubbed; reserved for future RAG re-enable |
| **Inpaint preview** | flux-schnell (Replicate) | Text-to-image, WebP, 4 steps, ~5-10s |
| **Image pre-processing** | OpenCV headless + numpy | CLAHE, crack/mould/water/blur detection; resize to 1024px max |
| **Image loading** | Pillow | Byte decoding |
| **Database** | Supabase (PostgreSQL 15) | Managed Postgres |
| **Vector search** | pgvector · IVFFlat | Reserved; cosine similarity |
| **File storage** | Supabase Storage | `repair-photos` bucket, enhanced images |
| **Voice STT** | Web Speech API | en-AU, 2s silence auto-submit |
| **Voice TTS** | Web Speech API | Shared emitter, markdown stripped |
| **Retailer links** | URL template generation | Bunnings / Amazon AU / Mitre 10 / Total Tools |
| **Deployment — backend** | Render (512MB free tier) | Auto-deploy from GitHub main |
| **Deployment — frontend** | Vercel / Static CDN | Vite build → static assets |

---

*Last updated May 2026 · task.ai v1.2*
