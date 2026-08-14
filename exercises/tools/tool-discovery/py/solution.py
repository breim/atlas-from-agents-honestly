import re


def _terms(query: str) -> set:
    return {word for word in re.split(r"[^a-z0-9]+", query.lower()) if word}


def assemble(catalogue: list, query: str, limit: int) -> dict:
    resident = [tool for tool in catalogue if tool["resident"]]
    if not any(tool["kind"] == "search" for tool in resident):
        return {"ok": False, "error": "no_resident_search"}
    if not any(tool["kind"] == "action" for tool in resident):
        return {"ok": False, "error": "no_resident_action"}

    words = _terms(query)
    scored = [
        (index, tool, sum(1 for keyword in tool["keywords"] if keyword in words))
        for index, tool in enumerate(catalogue)
    ]
    matches = [entry for entry in scored if not entry[1]["resident"] and entry[2] > 0]
    matches.sort(key=lambda entry: (-entry[2], entry[0]))
    appended = [tool for _, tool, _ in matches[:limit]]

    prefix_tokens = sum(tool["tokens"] for tool in resident)

    return {
        "ok": True,
        "resident": [tool["name"] for tool in resident],
        "appended": [tool["name"] for tool in appended],
        "prefixTokens": prefix_tokens,
        "totalTokens": prefix_tokens + sum(tool["tokens"] for tool in appended),
    }
