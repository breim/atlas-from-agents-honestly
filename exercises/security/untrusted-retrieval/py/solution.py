def retrieve(chunks: list, task: dict, policy: dict) -> dict:
    errors = []

    # Provenance is a column the loader assigns, never inferred from content.
    for chunk in chunks:
        if chunk["provenance"] == "inferred":
            errors.append(f"{chunk['id']} has provenance inferred from its content")

    # A vendor page that turns hostile after ingestion is otherwise a silent change.
    drifted = [c["id"] for c in chunks if c["contentHash"] != c["ingestedHash"]]
    for chunk_id in drifted:
        errors.append(f"{chunk_id} changed since it was ingested")

    competing = [c for c in chunks if task["query"] in c["competesFor"]]

    # High-authority workflows never read attacker-writable text.
    forbidden = [
        c
        for c in competing
        if c["provenance"] not in policy["highAuthorityProvenance"]
    ]
    if task["authority"] == "high" and forbidden:
        for chunk in forbidden:
            errors.append(
                f"{task['name']} is high authority and {chunk['id']} is {chunk['provenance']}"
            )

    if policy["requireCitations"] and not competing:
        errors.append(
            f"{task['name']} requires citations and nothing competes for its query"
        )

    if errors:
        return {
            "status": "refused",
            "errors": errors,
            "chunks": [],
            "tainted": False,
            "citations": [],
            "competingForQuery": len(competing),
            "poisonRatioBps": 0,
            "drifted": drifted,
            "writers": [],
        }

    # The ratio that matters is poisoned over what competes for that query.
    poisoned = len([c for c in competing if c["provenance"] == "customer-writable"])
    ratio = 0 if not competing else int(poisoned * 10000 / len(competing) + 0.5)

    # A corpus is the merge of every writer who ever had access to any of its sources.
    writers = sorted({w for c in competing for w in c["writers"]})

    return {
        "status": "served",
        "errors": errors,
        "chunks": [c["id"] for c in competing],
        # An external chunk taints the run exactly as a customer ticket does.
        "tainted": any(c["provenance"] != "first-party" for c in competing),
        "citations": [c["id"] for c in competing],
        "competingForQuery": len(competing),
        "poisonRatioBps": ratio,
        "drifted": drifted,
        "writers": writers,
    }
