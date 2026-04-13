from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import analyse, jobs

app = FastAPI(title="task.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyse.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
