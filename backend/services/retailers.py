from urllib.parse import quote_plus


def generate_links(material_name: str) -> dict:
    q = quote_plus(material_name)
    return {
        "bunnings": f"https://www.bunnings.com.au/search/results?q={q}",
        "amazon": f"https://www.amazon.com.au/s?k={q}",
        "mitre10": f"https://www.mitre10.com.au/search?q={q}",
        "totaltools": f"https://www.totaltools.com.au/search?q={q}",
    }
