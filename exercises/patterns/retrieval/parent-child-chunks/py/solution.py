def expand(hits: list, chunks: list, parents: dict) -> list:
    by_id = {chunk["id"]: chunk for chunk in chunks}
    seen: set = set()
    out: list = []

    for hit in hits:
        chunk = by_id.get(hit)
        if chunk is None:
            continue

        key = chunk["parentId"] or chunk["id"]
        if key in seen:
            continue
        seen.add(key)
        out.append(parents[chunk["parentId"]] if chunk["parentId"] else chunk["text"])

    return out
