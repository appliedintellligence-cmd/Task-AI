import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
_MODEL = "models/gemini-embedding-001"


def _build_text(result: dict) -> str:
    """Concatenate problem description and repair steps into a single string."""
    parts = []
    if problem := result.get("problem"):
        parts.append(f"Problem: {problem}")
    if steps := result.get("steps"):
        step_texts = [
            f"{s.get('title', '')}: {s.get('description', '')}"
            for s in steps
            if isinstance(s, dict)
        ]
        if step_texts:
            parts.append("Steps: " + " | ".join(step_texts))
    return " ".join(parts)


def generate_embedding(result: dict) -> list[float]:
    """Return a 768-dim embedding for a job result using Gemini text-embedding-004."""
    text = _build_text(result)
    response = _client.models.embed_content(
        model=_MODEL,
        contents=text,
        config={"output_dimensionality": 768},
    )
    return response.embeddings[0].values
