def compact(entries: list, budget: int) -> dict:
    survivors = {entry["id"] for entry in entries if entry["pinned"]}
    spent = sum(entry["tokens"] for entry in entries if entry["pinned"])

    for entry in reversed(entries):
        if entry["pinned"] or spent + entry["tokens"] > budget:
            continue
        spent += entry["tokens"]
        survivors.add(entry["id"])

    return {
        "kept": [entry["id"] for entry in entries if entry["id"] in survivors],
        "dropped": [entry["id"] for entry in entries if entry["id"] not in survivors],
    }
