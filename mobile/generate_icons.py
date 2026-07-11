"""Generates task.ai branded app icons for Expo."""
from PIL import Image, ImageDraw, ImageFont
import os

SIZES = {
    "assets/icon.png": 1024,
    "assets/splash.png": 2048,
    "assets/adaptive-icon.png": 1024,
}

BG = (10, 10, 10)
ORANGE = (249, 115, 22)
WHITE = (255, 255, 255)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Orange circle background
    pad = size * 0.12
    draw.ellipse([pad, pad, size - pad, size - pad], fill=ORANGE)

    # Wrench emoji substitute — simple wrench shape
    cx, cy = size / 2, size / 2
    r = size * 0.22

    # Circle (head of wrench)
    draw.ellipse([cx - r, cy - r * 1.5, cx + r, cy + r * 0.3], fill=BG, outline=BG)

    # Handle rectangle
    hw = r * 0.35
    draw.rectangle([cx - hw, cy - r * 0.3, cx + hw, cy + r * 1.6], fill=BG)

    # "t." text overlay — simple and clean
    try:
        font_size = int(size * 0.38)
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "t."
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - size * 0.04),
        text,
        fill=BG,
        font=font,
    )

    return img


def make_splash(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Centered text: task.ai
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size // 6)
        sub_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size // 18)
    except Exception:
        font = ImageFont.load_default()
        sub_font = font

    title = "task.ai"
    bbox = draw.textbbox((0, 0), title, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, size * 0.42 - th / 2), title, fill=ORANGE, font=font)

    sub = "Home repair intelligence"
    sbbox = draw.textbbox((0, 0), sub, font=sub_font)
    sw = sbbox[2] - sbbox[0]
    draw.text(((size - sw) / 2, size * 0.56), sub, fill=(107, 114, 128), font=sub_font)

    return img


os.makedirs("assets", exist_ok=True)
make_icon(1024).save("assets/icon.png")
make_icon(1024).save("assets/adaptive-icon.png")
make_splash(2048).save("assets/splash.png")
print("Icons generated: assets/icon.png, assets/splash.png, assets/adaptive-icon.png")
