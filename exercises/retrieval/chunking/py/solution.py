def _sum(blocks: list) -> int:
    return sum(block["tokens"] for block in blocks)


def chunk(document: dict, config: dict) -> dict:
    # Parents are the document's own sections, so the author decides where they begin.
    sections = []
    trail = []

    for block in document["blocks"]:
        if block["kind"] == "heading":
            trail = trail[: block["level"] - 1] + [block["text"]]
            sections.append({"trail": list(trail), "blocks": [block]})
            continue
        if not sections:
            sections.append({"trail": [], "blocks": []})
        sections[-1]["blocks"].append(block)

    parents = []
    children = []

    for section in sections:
        parent = {
            "id": f"p{len(parents) + 1}",
            "documentId": document["documentId"],
            "version": document["version"],
            "trail": section["trail"],
            "tokens": _sum(section["blocks"]),
            "blockIds": [block["id"] for block in section["blocks"]],
        }
        parents.append(parent)

        def emit(bucket: list, parent_id: str = parent["id"], trail: list = section["trail"]):
            children.append(
                {
                    "id": f"c{len(children) + 1}",
                    "parentId": parent_id,
                    "documentId": document["documentId"],
                    "version": document["version"],
                    "trail": trail,
                    "tokens": _sum(bucket),
                    "blockIds": [block["id"] for block in bucket],
                }
            )

        bucket = []
        for block in section["blocks"]:
            if block["kind"] == "heading":
                continue
            overflows = (
                bool(bucket)
                and _sum(bucket) + block["tokens"] > config["maxChildTokens"]
            )
            # A rule keeps its exception and a list keeps its items, cap or no cap.
            cannot_start = (
                config["strategy"] == "structural"
                and block["kind"] in config["neverStartsAChunk"]
            )
            if overflows and not cannot_start:
                emit(bucket)
                bucket = []
            bucket.append(block)
        if bucket:
            emit(bucket)

    return {"parents": parents, "children": children}
