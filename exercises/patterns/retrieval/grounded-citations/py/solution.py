def ground(claims: list, sources: list) -> list:
    retrieved = set(sources)
    grounded = []

    for claim in claims:
        cites = list(dict.fromkeys(cite for cite in claim["cites"] if cite in retrieved))
        if cites:
            grounded.append({"text": claim["text"], "cites": cites})

    return grounded
