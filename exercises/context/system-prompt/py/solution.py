def assemble(blocks: list, spec: list) -> dict:
    known = {entry["name"] for entry in spec}
    chosen: dict = {}
    ignored: list = []

    for block in blocks:
        # Unknown or already supplied: the spec decides, and the first block wins.
        if block["name"] not in known or block["name"] in chosen:
            ignored.append(block["name"])
            continue
        chosen[block["name"]] = block["text"]

    prompt = "\n\n".join(chosen[e["name"]] for e in spec if e["name"] in chosen)
    missing = [e["name"] for e in spec if e["required"] and e["name"] not in chosen]

    return {"prompt": prompt, "missing": missing, "ignored": ignored}
