import os
import json
import base64
from groq import Groq
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_groq = Groq(api_key=os.environ["GROQ_API_KEY"])
_gemini = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

SYSTEM_PROMPT = """
You are task.ai, an expert home repair assistant for Australian homeowners and tradespeople.

Always structure EVERY response in this exact format using markdown:

## 🔍 Problem Diagnosis
Brief description of the issue identified.
Severity: [Low / Medium / High]
Estimated time: [X hours]
Difficulty: [Beginner / Intermediate / Advanced]

## 🛠️ What You Need First
### Tools Required
- List every tool needed

### Safety Preparation
> ⚠️ List all safety warnings and PPE required

### Workspace Preparation
- Steps to prepare the area before starting

## 📋 Step-by-Step Instructions

### Method 1: [Primary Method Name]

**Step 1: [Step Title]**
- What to do
- How to do it
- Pro tip if relevant
- Time: X minutes

**Step 2: [Step Title]**
[continue for all steps]

### Method 2: [Alternative Method if applicable]
[same format]

## 🧰 Materials List

| Material | Quantity | Est. Cost AUD | Purpose |
|----------|----------|----------------|---------|
| [name]   | [qty]    | $[cost]        | [use]   |

**Estimated total cost: $XX – $XX AUD**

## 🛒 Where to Buy
I'll find the best prices across Bunnings, Amazon AU, and Mitre 10 for each material above.

## ✅ Quality Check
How to verify the repair was done correctly.

## 💡 Prevention Tips
How to prevent this issue recurring.

---
Always be specific to the exact material, colour, and surface mentioned by the user.
For Australian context: reference Australian standards, Bunnings product names where known, and metric measurements.
Never give generic advice — tailor every response to the specific repair described.
""".strip()

# Appended only at call-time so SYSTEM_PROMPT stays clean but materials extraction still works
_MATERIALS_INSTRUCTION = (
    "\n\nAfter your response, always append a machine-readable materials block with no extra text inside the tags:\n"
    '<materials>[{"name": "...", "quantity": "...", "estimated_cost_aud": 0.00}]</materials>\n'
    "Include all physical materials and tools listed above. If no materials are needed, omit the tags entirely."
)

# Kept for image analysis — returns structured JSON consumed by the RepairResult card
_IMAGE_PROMPT = """Analyse this home repair photo. Return ONLY valid JSON,
no markdown, no explanation, just raw JSON:
{
  "problem": "string (eg 'Cracked floor tile')",
  "severity": "low | medium | high",
  "surface_material": "string",
  "estimated_area": "string",
  "steps": [
    {
      "step_number": 1,
      "title": "string",
      "description": "string",
      "duration_minutes": 10
    }
  ],
  "materials": [
    {
      "name": "string",
      "quantity": 1,
      "unit": "string",
      "estimated_cost_aud": 10.00
    }
  ],
  "difficulty": "beginner | intermediate | advanced",
  "tools_required": ["string"],
  "safety_notes": ["string"]
}"""


async def analyse_image(image_bytes: bytes) -> dict:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    for attempt in range(2):
        try:
            response = _groq.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                            },
                            {"type": "text", "text": _IMAGE_PROMPT},
                        ],
                    },
                ],
                max_tokens=2048,
            )

            text = response.choices[0].message.content.strip()

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            return json.loads(text)

        except (json.JSONDecodeError, Exception) as e:
            if attempt == 1:
                raise ValueError(f"Failed to parse vision response: {e}")
            continue


def chat_reply(messages: list[dict]) -> str:
    # Convert OpenAI-style history to Gemini multi-turn format
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))

    response = _gemini.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + _MATERIALS_INSTRUCTION,
            temperature=0.3,
        ),
    )
    return response.text.strip()
