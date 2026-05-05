import httpx
import json
import os
import logging

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"

QWEN_VL_8B    = "qwen/qwen3-vl-8b-instruct"
QWEN_VL_32B   = "qwen/qwen3-vl-32b-instruct"
NEMOTRON_NANO = "nvidia/nemotron-3-nano-30b-a3b:free"
NEMOTRON_SUPER = "nvidia/nemotron-3-super-120b-a12b:free"


async def call_openrouter(
    model: str,
    messages: list,
    image_url: str = None
) -> str:
    """
    OpenAI-compatible call.
    Works for Qwen-VL (vision) and Nemotron (text).
    """
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://task.ai",
        "X-Title": "task.ai"
    }

    # Inject image into last user message
    if image_url:
        last = messages[-1]
        last["content"] = [
            {
                "type": "image_url",
                "image_url": {"url": image_url}
            },
            {
                "type": "text",
                "text": last["content"]
            }
        ]

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.1
            }
        )
        response.raise_for_status()

    return response.json()["choices"][0]["message"]["content"]


def clean_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON safely."""
    clean = raw.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1]
        if clean.startswith("json"):
            clean = clean[4:]
    return json.loads(clean.strip())


async def extract_facts_qwen(
    image_url: str,
    metrics_context: str = ""
) -> dict:
    """
    Stage 2 — Qwen-VL: visual facts only.
    No diagnosis. No advice. Facts grounded by OpenCV.
    """
    logger.info("Stage 2: Qwen-VL fact extraction")

    prompt = f"""
{metrics_context}

Examine this home repair photo carefully.
OpenCV measurements above are objective ground truth.
Your observations must be consistent with them.

Return ONLY raw observed facts as valid JSON.
No diagnosis. No repair advice. No guessing.

{{
  "surface_material": "exact material eg ceramic tile",
  "surface_colour": "exact colour eg gloss black",
  "surface_finish": "matte|gloss|textured|painted|raw",
  "damage_visible": true,
  "damage_types": ["crack","chip","stain","mould",
    "peeling","rust","rot","water_damage"],
  "damage_location": "position eg bottom-left corner",
  "damage_dimensions": "size eg 15cm x 8cm or unknown",
  "num_affected_areas": 1,
  "surrounding_condition": "good|fair|poor",
  "moisture_visible": false,
  "structural_elements_visible": false,
  "grout_condition": "good|cracked|missing|na",
  "additional_observations": "anything else relevant"
}}
"""

    raw = await call_openrouter(
        model=QWEN_VL_8B,
        messages=[{"role": "user", "content": prompt}],
        image_url=image_url
    )
    return clean_json(raw)


async def generate_repair_plan_nemotron(
    facts: dict,
    metrics_context: str = "",
    model: str = None
) -> dict:
    """
    Stage 3 — Nemotron: CoT reasoning + repair plan.
    Receives Qwen facts + OpenCV metrics as grounded input.
    """
    if model is None:
        model = NEMOTRON_NANO

    logger.info(f"Stage 3: Nemotron repair plan ({model})")

    system = """
You are a licensed Australian tradesperson and building
inspector with 20 years field experience.
You reason step by step before every answer.
You only work from confirmed facts — never invent damage.
Reference Australian products, standards, and metric units.
Bunnings product names preferred where known.
Be specific to the exact material and damage described.
"""

    user = f"""
{metrics_context}

Vision model confirmed these visual facts:
{json.dumps(facts, indent=2)}

The OpenCV measurements and visual facts above are
confirmed ground truth. Your repair plan must be
fully consistent with both.

Think step by step:
1. What caused this specific damage?
2. How severe is it — will it worsen if ignored?
3. Is it structural or cosmetic?
4. What is the correct Australian repair method?
5. What exact products from Bunnings are needed?
6. How confident am I? What is still unclear?

Return ONLY this JSON, no other text:
{{
  "confidence": 85,
  "confidence_reason": "clear image, obvious crack pattern",
  "needs_clarification": false,
  "clarification_question": null,
  "problem": "Cracked black ceramic floor tile",
  "severity": "low|medium|high",
  "root_cause": "specific cause explanation",
  "is_structural": false,
  "difficulty": "beginner|intermediate|advanced",
  "estimated_time_hours": 2,
  "estimated_cost_aud_min": 45,
  "estimated_cost_aud_max": 120,
  "steps": [
    {{
      "step_number": 1,
      "title": "action title",
      "description": "detailed specific instruction",
      "pro_tip": "expert tip for this exact situation",
      "duration_minutes": 20,
      "safety_note": "safety warning if any"
    }}
  ],
  "materials": [
    {{
      "name": "Ardex X77 Flexible Tile Adhesive",
      "quantity": 1,
      "unit": "kg",
      "estimated_cost_aud": 22,
      "purpose": "why this specific product"
    }}
  ],
  "tools_required": ["notched trowel", "grout float"],
  "safety_equipment": ["safety glasses", "P2 dust mask"],
  "when_to_call_professional": "specific trigger condition",
  "inpaint_prompt": "Perfectly repaired [material] [colour] [finish], no cracks or damage, professional finish, photorealistic, same lighting as original photo"
}}
"""

    raw = await call_openrouter(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ]
    )
    return clean_json(raw)
