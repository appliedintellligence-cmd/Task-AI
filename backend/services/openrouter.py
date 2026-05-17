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
        model = NEMOTRON_NANO

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
      "description": "Remove all furniture and floor coverings from the area. Sweep and mop the floor. Use a stiff brush to remove any loose debris from the crack. Vacuum out dust from inside the crack using a crevice attachment.",
      "pro_tip": "Wipe the crack with methylated spirits on a rag to degrease — adhesion fails on dusty or oily surfaces.",
      "duration_minutes": 15,
      "safety_note": "Wear knee pads if working on floor tiles"
    }},
    {{
      "step_number": 2,
      "phase": "preparation",
      "title": "Assess crack depth and remove loose tile pieces",
      "description": "Use a grout saw or oscillating tool to remove grout from around any loose tile sections. Gently tap the tile with a rubber mallet — a hollow sound means the tile has lifted from the substrate and must be fully removed before re-laying.",
      "pro_tip": "Mark loose sections with masking tape before starting so you don't lose track.",
      "duration_minutes": 20,
      "safety_note": "Wear safety glasses — tile chips are sharp projectiles"
    }},
    {{
      "step_number": 3,
      "phase": "tools_required",
      "title": "Gather all tools before starting",
      "description": "Lay out every tool you will need: grout saw, rubber mallet, cold chisel, notched trowel (6mm V-notch for floor tiles), grout float, sponge, two buckets, mixing paddle (or stir stick), tape measure, pencil, and a damp cloth. Having everything to hand prevents interruptions mid-repair.",
      "pro_tip": "Rent a mixing paddle from Bunnings if you do not own one — it ensures lump-free adhesive.",
      "duration_minutes": 10,
      "safety_note": null
    }},
    {{
      "step_number": 4,
      "phase": "products_needed",
      "title": "Purchase and prepare all products",
      "description": "You will need: tile adhesive (Ardex X77 or similar flexible adhesive for floors), matching grout (take a photo of the existing grout to match colour in-store), grout sealer, tile spacers (2mm for standard floor tiles), and methylated spirits for cleaning. Check the existing tile against Bunnings tile samples to find the closest match if a replacement tile is needed.",
      "pro_tip": "Buy 10% more grout than you think you need — colour batches vary between bags.",
      "duration_minutes": 5,
      "safety_note": null
    }},
    {{
      "step_number": 5,
      "phase": "how_to_fix",
      "title": "Mix and apply tile adhesive",
      "description": "Mix Ardex X77 adhesive according to packet directions (typically 3 parts powder to 1 part water) until smooth with no lumps. Using the notched trowel, apply adhesive to the substrate using the flat edge first to key the surface, then comb through with the notched edge held at 45 degrees to create even ridges. Work in sections no larger than 0.5 sqm to prevent the adhesive skinning over.",
      "pro_tip": "Back-butter the replacement tile as well as the floor for maximum bond — especially important for large-format tiles.",
      "duration_minutes": 20,
      "safety_note": "Work in a ventilated area — adhesive fumes can build up in enclosed spaces"
    }},
    {{
      "step_number": 6,
      "phase": "how_to_fix",
      "title": "Set tile and check level",
      "description": "Press the replacement tile firmly into position with a slight twisting motion to collapse the adhesive ridges and maximise contact. Place tile spacers on all four sides. Use a spirit level and rubber mallet to tap the tile flush with adjacent tiles — check in both directions. Remove any adhesive that squeezes up through the grout joints immediately with a damp sponge.",
      "pro_tip": "Stand back and view the tile from a low angle with a torch to spot any lippage (edge height difference) before the adhesive sets.",
      "duration_minutes": 15,
      "safety_note": null
    }},
    {{
      "step_number": 7,
      "phase": "how_to_fix",
      "title": "Allow adhesive to cure then grout",
      "description": "Allow adhesive to cure for a minimum of 24 hours (48 hours in cool or humid conditions) before grouting. Remove tile spacers. Mix grout to a peanut butter consistency. Apply diagonally across the joints using a grout float, pressing firmly to pack joints completely. Remove excess grout with the float edge held at 90 degrees. Wait 15-20 minutes then wipe with a damp (not wet) sponge using circular motions. Polish haze with a dry cloth after 1 hour.",
      "pro_tip": "Do not walk on the repair area for 24 hours after grouting.",
      "duration_minutes": 60,
      "safety_note": "Grout is alkaline — wear gloves to avoid skin irritation"
    }},
    {{
      "step_number": 8,
      "phase": "post_fix",
      "title": "Seal the grout and clean up",
      "description": "After the grout has cured for 72 hours, apply a penetrating grout sealer (Selleys Grout Refresh or similar) using a small brush or applicator bottle along each grout line. Wipe excess off the tile face within 5 minutes. Allow to dry for 2 hours before allowing foot traffic. This prevents staining and moisture ingress which caused the original damage.",
      "pro_tip": "Re-apply grout sealer every 12 months in wet areas and every 2 years in dry areas.",
      "duration_minutes": 30,
      "safety_note": null
    }},
    {{
      "step_number": 9,
      "phase": "post_fix",
      "title": "Inspect and document",
      "description": "After 7 days, inspect the repair in raking light (torch held at a low angle). Check for any cracking, hollow sounds (tap with knuckle), or grout colour mismatch. Photograph the completed repair for your records. If the damage recurred due to movement or structural flex, consult a licensed tiler to assess substrate suitability.",
      "pro_tip": "Keep the remaining grout and any spare tiles stored in a dry place — they are invaluable for future touch-ups.",
      "duration_minutes": 10,
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
