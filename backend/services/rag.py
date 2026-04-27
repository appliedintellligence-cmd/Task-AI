import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])


def embed_text(text: str) -> list[float]:
    """Return a 768-dim embedding for any text string."""
    result = client.models.embed_content(
        model="models/embedding-001",
        contents=text,
    )
    return result.embeddings[0].values


def search_similar(embedding: list[float], threshold: float = 0.6, limit: int = 5) -> list[dict]:
    """Call the match_messages Supabase RPC and return matching past assistant messages."""
    from services.supabase import call_match_messages_rpc
    return call_match_messages_rpc(embedding, match_threshold=threshold, match_count=limit)


def build_context(similar_results: list[dict]) -> str:
    """Format similar past repairs as a context string to inject into the LLM prompt."""
    if not similar_results:
        return ""
    lines = ["Based on similar past repairs:"]
    for r in similar_results:
        content = r.get("content") or ""
        result_json = r.get("result_json") or {}
        problem = result_json.get("problem") or content[:80]
        steps = result_json.get("steps") or []
        step_summary = " → ".join(s.get("title", "") for s in steps[:3] if isinstance(s, dict))
        line = f"- {problem}"
        if step_summary:
            line += f": {step_summary}"
        lines.append(line)
    return "\n".join(lines)
