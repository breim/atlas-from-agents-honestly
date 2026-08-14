def shape(present: list, spec: list, budget: int) -> dict:
    known = [field for field in spec if field["name"] in present]

    # Essentials are kept whatever they cost; going over budget is reported, not trimmed.
    kept = [field for field in known if field["essential"]]
    tokens = sum(field["tokens"] for field in kept)
    fits = tokens <= budget

    for field in [f for f in known if not f["essential"]]:
        if tokens + field["tokens"] > budget:
            continue
        tokens += field["tokens"]
        kept.append(field)

    kept_names = {field["name"] for field in kept}

    return {
        "kept": [f["name"] for f in spec if f["name"] in kept_names],
        "dropped": [name for name in present if name not in kept_names],
        "tokens": tokens,
        "fits": fits,
    }
