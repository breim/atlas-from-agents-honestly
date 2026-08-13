import re


def route(request: str, routes: list, fallback: str) -> str:
    present = set(re.split(r"[^a-z0-9]+", request.lower())) - {""}

    for candidate in routes:
        if any(word in present for word in candidate["any"]):
            return candidate["name"]

    return fallback
