import base64
import json
import os
import logging
import httpx
from groq import Groq

logger = logging.getLogger(__name__)

_groq = Groq(api_key=os.environ["GROQ_API_KEY"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# Nemotron models are free on OpenRouter (:free suffix)
NEMOTRON_NANO  = "nvidia/nemotron-3-nano-30b-a3b:free"
NEMOTRON_SUPER = "nvidia/nemotron-3-super-120b-a12b:free"

_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def clean_json(raw: str) -> dict:
    if not raw:
        raise ValueError("Model returned empty response")
    clean = raw.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = parts[1]
        if clean.startswith("json"):
            clean = clean[4:]
    return json.loads(clean.strip())


async def extract_facts_qwen(image_bytes: bytes, metrics_context: str = "") -> dict:
    """Stage 2 — visual fact extraction via Groq vision model (base64)."""
    logger.info("Stage 2: Groq vision fact extraction")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:image/jpeg;base64,{b64}"

    prompt = f"""{metrics_context}

Examine this home repair photo carefully.
OpenCV measurements above are objective ground truth.
Your observations must be consistent with them.

Return ONLY raw observed facts as valid JSON, no markdown fences.

{{
  "surface_material": "exact material eg ceramic tile",
  "surface_colour": "exact colour eg gloss black",
  "surface_finish": "matte|gloss|textured|painted|raw",
  "damage_visible": true,
  "damage_types": ["crack","chip","stain","mould","peeling","rust","rot","water_damage"],
  "damage_location": "position eg bottom-left corner",
  "damage_dimensions": "size eg 15cm x 8cm or unknown",
  "num_affected_areas": 1,
  "surrounding_condition": "good|fair|poor",
  "moisture_visible": false,
  "structural_elements_visible": false,
  "grout_condition": "good|cracked|missing|na",
  "additional_observations": "anything else relevant"
}}"""

    response = _groq.chat.completions.create(
        model=_VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": prompt},
            ],
        }],
        max_tokens=1024,
        temperature=0.1,
    )
    return clean_json(response.choices[0].message.content)


async def generate_repair_plan_nemotron(
    facts: dict,
    metrics_context: str = "",
    model: str = None,
) -> dict:
    """Stage 3 — repair plan via Nemotron on OpenRouter (free tier)."""
    if model is None:
        model = NEMOTRON_SUPER

    logger.info(f"Stage 3: Nemotron repair plan ({model})")

    system = """You are a licensed Australian tradesperson and building inspector with 20 years field experience.
You produce thorough, actionable repair guides that a homeowner can follow without prior trade knowledge.
You only work from confirmed facts — never invent damage.
Reference Australian products and Bunnings product names where known. Use metric units.
Every repair plan MUST cover all five phases: Preparation, Tools Required, Products Needed, How to Fix, and Post-Fix Tasks.
Each phase must have at least 2 detailed steps. Never produce fewer than 8 steps total."""

    user = f"""{metrics_context}

Vision model confirmed these visual facts:
{json.dumps(facts, indent=2)}

The OpenCV measurements and visual facts above are confirmed ground truth.
Your repair plan must be fully consistent with both.

Think step by step before writing the plan:
1. What caused this specific damage and how did it progress?
2. How severe is it — will it worsen if ignored?
3. Is it structural or cosmetic?
4. What is the full correct Australian repair method, start to finish?
5. What exact Bunnings products are needed and why each one?
6. What preparation is required before touching the damage?
7. What must be done AFTER the repair to ensure it lasts?
8. How confident am I and what is still unclear?

Return ONLY valid JSON, no markdown, no commentary:
{{
  "confidence": 85,
  "confidence_reason": "clear image, obvious crack pattern",
  "needs_clarification": false,
  "clarification_question": null,
  "problem": "Cracked black ceramic floor tile",
  "severity": "low|medium|high",
  "root_cause": "specific cause explanation including what likely caused it",
  "is_structural": false,
  "difficulty": "beginner|intermediate|advanced",
  "estimated_time_hours": 2,
  "estimated_cost_aud_min": 45,
  "estimated_cost_aud_max": 120,
  "safety_notes": [
    "Wear safety glasses when chiselling",
    "Ensure adequate ventilation when using adhesives"
  ],
  "steps": [
    {{
      "step_number": 1,
      "phase": "preparation",
      "title": "Clear and clean the repair area",
      "description": "Detailed description of what to do and how to do it for this specific damage",
      "pro_tip": "Expert tip specific to this material and situation",
      "duration_minutes": 15,
      "safety_note": "Safety warning or null"
    }},
    {{
      "step_number": 2,
      "phase": "tools_required",
      "title": "Gather all tools",
      "description": "List every tool needed with sizes and specs",
      "pro_tip": "Where to source or rent tools in Australia",
      "duration_minutes": 10,
      "safety_note": null
    }},
    {{
      "step_number": 3,
      "phase": "products_needed",
      "title": "Purchase all materials",
      "description": "Specific Bunnings product names, quantities, and why each is needed",
      "pro_tip": "Buying tip specific to this repair",
      "duration_minutes": 5,
      "safety_note": null
    }},
    {{
      "step_number": 4,
      "phase": "how_to_fix",
      "title": "First repair action",
      "description": "Detailed step-by-step instructions for this phase",
      "pro_tip": "Trade secret for this specific repair",
      "duration_minutes": 30,
      "safety_note": "PPE or hazard warning if applicable"
    }},
    {{
      "step_number": 5,
      "phase": "how_to_fix",
      "title": "Second repair action",
      "description": "Continue with next repair action in detail",
      "pro_tip": "Pro tip",
      "duration_minutes": 20,
      "safety_note": null
    }},
    {{
      "step_number": 6,
      "phase": "post_fix",
      "title": "Cure, seal and finish",
      "description": "Curing times, sealing method, and finishing steps",
      "pro_tip": "How to test the repair is successful",
      "duration_minutes": 20,
      "safety_note": null
    }}
  ],
  "materials": [
    {{
      "name": "Ardex X77 Flexible Tile Adhesive",
      "quantity": 1,
      "unit": "kg",
      "estimated_cost_aud": 22,
      "purpose": "Bonds replacement tile to substrate with flexibility to resist movement cracking"
    }}
  ],
  "tools_required": ["grout saw", "rubber mallet", "cold chisel", "6mm notched trowel", "grout float", "spirit level", "sponge", "two buckets", "mixing paddle"],
  "safety_equipment": ["safety glasses", "knee pads", "nitrile gloves", "dust mask P2"],
  "when_to_call_professional": "If tapping reveals more than 3 hollow tiles, if there is visible substrate cracking or movement, or if water damage extends beneath the substrate",
  "inpaint_prompt": "Perfectly repaired [material] [colour] [finish], no cracks or damage, professional finish, photorealistic, same lighting as original photo"
}}"""

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://task.ai",
                "X-Title": "task.ai",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.1,
                "max_tokens": 4096,
            },
        )
        response.raise_for_status()

    return clean_json(response.json()["choices"][0]["message"]["content"])
