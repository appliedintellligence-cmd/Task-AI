import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


def extract_metrics(image_bytes: bytes) -> tuple[dict, bytes]:
    """
    Stage 1.5 — Extract objective image metrics.
    Returns (metrics_dict, enhanced_image_bytes).
    Never raises — returns empty metrics on failure.
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return _empty_metrics("decode_failed"), image_bytes

        h, w = img.shape[:2]

        # ── CLAHE contrast enhancement ──────────────
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(
            clipLimit=3.0, tileGridSize=(8, 8)
        )
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        # ── Crack / edge detection ───────────────────
        gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        crack_pixels = int(np.sum(edges > 0))
        total_pixels = int(edges.size)
        crack_ratio_pct = round(
            (crack_pixels / total_pixels) * 100, 2
        )

        # ── Affected area estimation ─────────────────
        _, thresh = cv2.threshold(
            gray, 80, 255, cv2.THRESH_BINARY_INV
        )
        contours, _ = cv2.findContours(
            thresh,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        if contours:
            largest = max(contours, key=cv2.contourArea)
            damage_area = cv2.contourArea(largest)
            affected_area_pct = round(
                (damage_area / total_pixels) * 100, 2
            )
        else:
            affected_area_pct = 0.0

        # ── Mould detection (green-black HSV) ────────
        hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
        mould_mask = cv2.inRange(
            hsv,
            np.array([35, 40, 20]),
            np.array([85, 255, 100])
        )
        mould_detected = (
            np.sum(mould_mask > 0) / total_pixels
        ) > 0.02

        # ── Water stain detection (yellow-brown) ─────
        water_mask = cv2.inRange(
            hsv,
            np.array([15, 30, 100]),
            np.array([35, 150, 255])
        )
        water_stain_detected = (
            np.sum(water_mask > 0) / total_pixels
        ) > 0.03

        # ── Blur detection ───────────────────────────
        laplacian_var = float(
            cv2.Laplacian(gray, cv2.CV_64F).var()
        )
        is_blurry = laplacian_var < 100

        # ── Brightness ───────────────────────────────
        brightness = float(np.mean(gray))
        image_quality = (
            "good" if brightness > 80
            else "dark" if brightness < 40
            else "acceptable"
        )

        # ── Convert enhanced back to bytes ───────────
        _, buf = cv2.imencode(
            '.jpg', enhanced,
            [cv2.IMWRITE_JPEG_QUALITY, 92]
        )
        enhanced_bytes = buf.tobytes()

        metrics = {
            "crack_ratio_pct": crack_ratio_pct,
            "affected_area_pct": affected_area_pct,
            "mould_detected": bool(mould_detected),
            "water_stain_detected": bool(water_stain_detected),
            "image_brightness": round(brightness, 1),
            "image_quality": image_quality,
            "is_blurry": is_blurry,
            "image_width_px": w,
            "image_height_px": h,
            "opencv_status": "success"
        }

        logger.info(f"OpenCV metrics extracted: {metrics}")
        return metrics, enhanced_bytes

    except Exception as e:
        logger.error(f"OpenCV extraction failed: {e}")
        return _empty_metrics(str(e)), image_bytes


def build_metrics_context(metrics: dict) -> str:
    """
    Format metrics as natural language for prompt injection.
    Injected into both Qwen and Nemotron prompts.
    """
    if metrics["opencv_status"] != "success":
        return ""

    lines = [
        "=== OpenCV Pre-Analysis (objective measurements) ===",
    ]

    if metrics["crack_ratio_pct"] > 1.0:
        lines.append(
            f"- Edge density: {metrics['crack_ratio_pct']}% "
            f"(visible surface cracking or damage)"
        )
    if metrics["affected_area_pct"] > 0:
        lines.append(
            f"- Affected area: ~{metrics['affected_area_pct']}% "
            f"of image frame"
        )
    if metrics["mould_detected"]:
        lines.append(
            "- Mould signature DETECTED (green-black HSV range)"
        )
    if metrics["water_stain_detected"]:
        lines.append(
            "- Water stain signature DETECTED (yellow-brown tones)"
        )
    if metrics["is_blurry"]:
        lines.append(
            "- Image is blurry — treat all dimensions as estimates"
        )

    lines.append(
        f"- Brightness: {metrics['image_brightness']}/255 "
        f"({metrics['image_quality']})"
    )
    lines.append(
        "These are objective measurements. "
        "Your analysis must be consistent with them. "
        "Do not contradict these metrics."
    )
    lines.append("=" * 48)

    return "\n".join(lines)


def _empty_metrics(reason: str) -> dict:
    return {
        "crack_ratio_pct": 0.0,
        "affected_area_pct": 0.0,
        "mould_detected": False,
        "water_stain_detected": False,
        "image_brightness": 128.0,
        "image_quality": "unknown",
        "is_blurry": False,
        "image_width_px": 0,
        "image_height_px": 0,
        "opencv_status": f"failed:{reason}"
    }
