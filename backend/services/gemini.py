import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

PROMPT = """Analyse this home repair photo. Return ONLY valid JSON,
no markdown, no explanation, just raw JSON:
{
  "problem": "string (eg 'Cracked floor tile')",
  "severity": "low | medium | high",
  "surface_material": "string",
  "estimated_area": "string",
  "steps": [
    {
      "step_number": "number",
      "title": "string",
      "description": "string",
      "duration_minutes": "number"
    }
  ],
  "materials": [
    {
      "name": "string",
      "quantity": "number",
      "unit": "string",
      "estimated_cost_aud": "number"
    }
  ],
  "difficulty": "beginner | intermediate | advanced",
  "tools_required": ["string"],
  "safety_notes": ["string"]
}"""


async def analyse_image(image_bytes: bytes) -> dict:
    model = genai.GenerativeModel("gemini-2.0-flash")

    image_part = {"mime_type": "image/jpeg", "data": image_bytes}

    for attempt in range(2):
        try:
            response = model.generate_content([PROMPT, image_part])
            text = response.text.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            return json.loads(text)
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 1:
                raise ValueError(f"Failed to parse Gemini response: {e}")
            continue
