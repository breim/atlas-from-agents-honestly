def guard(text: str, rules: list) -> dict:
    hits: list = []
    blocked = False
    out = text

    for rule in rules:
        if rule["pattern"] not in out:
            continue

        hits.append(rule["label"])
        if rule["action"] == "block":
            blocked = True
        else:
            out = out.replace(rule["pattern"], f"[redacted:{rule['label']}]")

    if blocked:
        return {"released": False, "text": "", "hits": hits}
    return {"released": True, "text": out, "hits": hits}
