import os
import json
import base64
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.environ["GROQ_API_KEY"])

PROMPT = """Analyse this home repair photo. Return ONLY valid JSON,
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
            response = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                },
                            },
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
                max_tokens=2048,
            )

            text = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            return json.loads(text)

        except (json.JSONDecodeError, Exception) as e:
            if attempt == 1:
                raise ValueError(f"Failed to parse vision response: {e}")
            continue


CHAT_SYSTEM = (
    "Format your response using markdown:\n"
    "- Use ## for section headings\n"
    "- Use **bold** for key terms\n"
    "- Use numbered lists for steps\n"
    "- Use bullet points for materials\n"
    "- Use > blockquote for safety warnings\n"
    "- Keep paragraphs short, max 3 lines\n\n"
    "You are task.ai, an expert home repair and maintenance assistant. "
    "Help users diagnose problems, recommend materials and tools, and provide "
    "clear step-by-step repair guidance. Be concise and safety-conscious.\n\n"
    "Always end your response with a MATERIALS section listing every material "
    "and tool needed. Format it exactly as a JSON array wrapped in XML tags — "
    "no extra text inside the tags:\n"
    '<materials>[{"name": "...", "quantity": "...", "estimated_cost_aud": 0.00}]</materials>\n'
    "Include all physical materials and tools. If no materials are needed, omit the tags entirely."
)


def chat_reply(messages: list[dict]) -> str:
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{"role": "system", "content": CHAT_SYSTEM}] + messages,
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()
