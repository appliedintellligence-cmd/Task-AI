"""
Repair State Engine — Stage 3.5

Sits between Nemotron reasoning (Stage 3) and Flux inpainting.
Takes structured vision facts + repair plan and produces:
  - before_state: structured description of current damage
  - after_state: target state after successful repair
  - inpaint_prompt: Flux Schnell-optimised photorealistic prompt
  - prompt_confidence: how specific we could be (0-100)

Entirely deterministic — no LLM call, no latency, no cost.
"""

from __future__ import annotations

# ── Material knowledge base ──────────────────────────────────────────────────

_MATERIAL_PROFILES: dict[str, dict] = {
    # Tile & stone
    "ceramic tile":     {"texture": "smooth glazed surface with grout lines", "light": "specular highlights, reflective"},
    "porcelain tile":   {"texture": "fine dense surface with thin grout lines", "light": "semi-specular, polished"},
    "terracotta tile":  {"texture": "rough matte terracotta with grout lines", "light": "diffuse, earthy"},
    "slate tile":       {"texture": "natural cleft slate texture, irregular surface", "light": "low-gloss diffuse"},
    "marble tile":      {"texture": "polished marble with natural veining", "light": "high-specular, reflective"},
    "travertine":       {"texture": "porous travertine stone with natural pits", "light": "matte to satin"},
    "stone":            {"texture": "natural stone texture", "light": "matte diffuse"},
    "concrete":         {"texture": "smooth to aggregate concrete surface", "light": "matte, micro-porous"},

    # Timber & wood
    "timber":           {"texture": "natural wood grain, fibrous parallel lines", "light": "satin diffuse"},
    "hardwood":         {"texture": "dense hardwood grain, tight knots", "light": "satin to semi-gloss"},
    "softwood":         {"texture": "open grain softwood, visible knots", "light": "matte diffuse"},
    "plywood":          {"texture": "layered veneer surface, smooth face", "light": "satin diffuse"},
    "particleboard":    {"texture": "uniform smooth composite surface", "light": "matte"},
    "mdf":              {"texture": "very smooth uniform composite surface", "light": "matte"},
    "floorboard":       {"texture": "long-grain timber boards with expansion gaps", "light": "satin to gloss finish"},
    "decking":          {"texture": "weathered or oiled hardwood decking boards", "light": "matte to satin"},
    "timber frame":     {"texture": "structural timber, rough sawn or dressed", "light": "matte"},

    # Plaster & drywall
    "plaster":          {"texture": "smooth painted plaster, slight texture", "light": "matte, uniform"},
    "render":           {"texture": "textured cement render, aggregate visible", "light": "matte"},
    "gyprock":          {"texture": "smooth painted plasterboard surface", "light": "matte, uniform"},
    "drywall":          {"texture": "smooth painted gypsum board", "light": "matte, uniform"},
    "fibro":            {"texture": "fibre cement sheet, fine texture", "light": "matte"},

    # Masonry
    "brick":            {"texture": "fired clay brick face, mortar joints", "light": "diffuse matte, rough"},
    "mortar":           {"texture": "cement mortar joint, slightly rough", "light": "matte"},
    "blockwork":        {"texture": "concrete masonry unit face, coarse aggregate", "light": "matte diffuse"},
    "limestone":        {"texture": "soft porous limestone, fine granular", "light": "matte"},
    "sandstone":        {"texture": "granular sandstone, warm toned", "light": "matte diffuse"},

    # Metal & roofing
    "steel":            {"texture": "smooth or brushed metal surface", "light": "high specular, reflective"},
    "galvanised steel": {"texture": "zinc-spangle patterned galvanised surface", "light": "semi-specular"},
    "corrugated iron":  {"texture": "corrugated metal sheeting, ribbed profile", "light": "semi-specular"},
    "colorbond":        {"texture": "smooth painted steel cladding", "light": "low-gloss satin"},
    "copper":           {"texture": "copper surface, patina or polished", "light": "specular, warm tone"},
    "aluminium":        {"texture": "anodised or painted aluminium surface", "light": "satin to semi-specular"},
    "roof tile":        {"texture": "terracotta or concrete roof tile, aged", "light": "matte diffuse"},
    "colorbond roof":   {"texture": "profiled Colorbond steel roofing", "light": "low-gloss satin"},

    # Coatings & finishes
    "paint":            {"texture": "flat painted surface, uniform colour", "light": "matte to satin"},
    "render coat":      {"texture": "acrylic or cement render, fine texture", "light": "matte"},
    "sealant":          {"texture": "smooth flexible sealant bead", "light": "satin"},
    "grout":            {"texture": "fine-aggregate grout fill between tiles", "light": "matte"},

    # Fabric & ceiling
    "carpet":           {"texture": "textile pile surface, uniform texture", "light": "diffuse, soft"},
    "vinyl":            {"texture": "smooth resilient vinyl surface", "light": "satin, slightly reflective"},
    "lino":             {"texture": "linoleum surface, slight texture", "light": "matte to satin"},
    "ceiling":          {"texture": "smooth painted ceiling plaster", "light": "matte, uniform white"},
    "cornice":          {"texture": "ornate or plain plaster cornice profile", "light": "matte, white"},

    # Glass & glazing
    "glass":            {"texture": "clear or obscured glass surface", "light": "transparent, specular reflections"},
    "window":           {"texture": "clear glass pane in frame", "light": "transparent"},
}

_DEFAULT_PROFILE = {"texture": "smooth uniform surface", "light": "diffuse"}

# ── Damage resolution map ────────────────────────────────────────────────────

_DAMAGE_RESOLUTION: dict[str, str] = {
    "crack":        "hairline crack fully sealed, surface flush and continuous, no visible gap",
    "chip":         "chip filled and smoothed flush, colour-matched, seamless edge blend",
    "stain":        "completely clean uniform surface, no discolouration or marks",
    "mould":        "clean treated surface, uniform colour, no dark spots or biological growth",
    "peeling":      "smooth freshly painted surface, even uniform coat, no lifted edges",
    "rust":         "rust removed, clean metal surface, bare or primed, ready for paint",
    "rot":          "replaced fresh timber, matching grain and colour, structurally sound",
    "water_damage": "dry even surface, no water marks, staining or tide lines",
    "scratch":      "surface refinished, scratch invisible, matching sheen",
    "hole":         "filled and plastered over, smooth flush finish, ready to paint",
    "spalling":     "concrete patched flush, aggregate matched, smooth surface",
    "efflorescence":"clean masonry face, salt deposits removed, dry uniform surface",
    "damp":         "dry treated surface, no moisture bleed or staining",
    "fading":       "fresh uniform colour, matching adjacent surfaces, even sheen",
    "delamination": "substrate re-adhered, surface flat and even, no bubbles or lifting",
    "joint_failure":"new flexible sealant bead, smooth tooled finish, correct colour",
}

# ── Flux Schnell prompt builder ──────────────────────────────────────────────

_FLUX_QUALITY = (
    "photorealistic, high resolution DSLR photo, sharp focus, "
    "natural interior lighting, Australian home"
)

_FINISH_ADJECTIVES: dict[str, str] = {
    "matte":     "matte flat",
    "gloss":     "high-gloss shiny",
    "satin":     "satin low-sheen",
    "textured":  "textured",
    "painted":   "painted",
    "raw":       "unfinished raw",
}


def _normalise(text: str) -> str:
    return text.lower().strip()


def _match_material(raw: str) -> dict:
    """Fuzzy-match raw material string to closest profile."""
    raw_n = _normalise(raw)
    # exact match
    if raw_n in _MATERIAL_PROFILES:
        return _MATERIAL_PROFILES[raw_n]
    # substring match (longest wins)
    candidates = [(k, v) for k, v in _MATERIAL_PROFILES.items() if k in raw_n or raw_n in k]
    if candidates:
        return max(candidates, key=lambda x: len(x[0]))[1]
    return _DEFAULT_PROFILE


def _build_inpaint_prompt(
    material: str,
    colour: str,
    finish: str,
    damage_types: list[str],
    profile: dict,
) -> str:
    colour_part = f"{colour} " if colour and colour.lower() not in ("unknown", "na", "") else ""
    finish_part = _FINISH_ADJECTIVES.get(_normalise(finish), finish) + " " if finish and finish not in ("unknown", "na", "") else ""
    material_desc = f"{colour_part}{finish_part}{material}"

    resolutions = [
        _DAMAGE_RESOLUTION[d] for d in damage_types if d in _DAMAGE_RESOLUTION
    ]
    if not resolutions:
        resolutions = ["perfectly repaired, no visible damage"]

    resolution_str = "; ".join(resolutions)
    texture_note = profile["texture"]
    light_note = profile["light"]

    return (
        f"Close-up photograph of {material_desc}, {resolution_str}. "
        f"Surface shows {texture_note}, {light_note}. "
        f"Professional repair result, identical to undamaged area. "
        f"{_FLUX_QUALITY}."
    )


# ── Public API ───────────────────────────────────────────────────────────────

def build_repair_state(facts: dict, plan: dict) -> dict:
    """
    Derive a structured repair state and Flux-optimised inpaint prompt
    from Maverick vision facts and Nemotron repair plan.

    Returns a dict merged into the final /analyse response under `repair_state`.
    Also injects `inpaint_prompt` at the top level, overriding Nemotron's version.
    """
    material   = facts.get("surface_material", "surface")
    colour     = facts.get("surface_colour", "")
    finish     = facts.get("surface_finish", "")
    damage_types: list[str] = facts.get("damage_types", [])
    damage_loc = facts.get("damage_location", "")
    damage_dim = facts.get("damage_dimensions", "unknown")
    surrounding = facts.get("surrounding_condition", "")
    moisture   = facts.get("moisture_visible", False)

    profile = _match_material(material)

    # Augment damage list from plan context
    if plan.get("is_structural") and "crack" not in damage_types:
        damage_types = damage_types + ["crack"]
    if moisture and "damp" not in damage_types and "water_damage" not in damage_types:
        damage_types = damage_types + ["damp"]

    inpaint_prompt = _build_inpaint_prompt(material, colour, finish, damage_types, profile)

    # Compute prompt specificity score (how much detail we had to work with)
    detail_fields = [material, colour, finish, damage_types, damage_loc, damage_dim]
    filled = sum(1 for f in detail_fields if f and f not in ("unknown", "na", [], ""))
    prompt_confidence = round((filled / len(detail_fields)) * 100)

    before_state = {
        "material":    material,
        "colour":      colour,
        "finish":      finish,
        "damage_types": damage_types,
        "damage_location": damage_loc,
        "damage_dimensions": damage_dim,
        "surrounding_condition": surrounding,
        "moisture_visible": moisture,
    }

    after_state = {
        "material": material,
        "colour":   colour,
        "finish":   finish,
        "condition": "repaired",
        "resolutions": {
            d: _DAMAGE_RESOLUTION.get(d, "repaired") for d in damage_types
        },
        "texture_profile": profile["texture"],
        "light_profile":   profile["light"],
    }

    return {
        "repair_state": {
            "before": before_state,
            "after":  after_state,
            "inpaint_prompt": inpaint_prompt,
            "prompt_confidence": prompt_confidence,
            "engine": "repair-state-v1",
        },
        "inpaint_prompt": inpaint_prompt,  # top-level override
    }
