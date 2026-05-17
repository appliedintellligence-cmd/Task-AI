# RAG embeddings disabled — google-genai removed to stay within 512MB RAM limit.
# embed_text returns None; search_similar returns [] so chat falls through to direct LLM.


def embed_text(text: str) -> None:
    return None


def search_similar(embedding, threshold: float = 0.6, limit: int = 5) -> list[dict]:
    if embedding is None:
        return []
    from services.supabase import call_match_messages_rpc
    return call_match_messages_rpc(embedding, match_threshold=threshold, match_count=limit)


def build_context(similar_results: list[dict]) -> str:
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
