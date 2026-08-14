def reconcile(snapshot: dict, projection: list) -> dict:
    local = {record["id"]: record["version"] for record in projection}

    missing = []
    stale = []
    ahead = []

    for record in snapshot["records"]:
        version = local.get(record["id"])
        if version is None:
            missing.append(record["id"])
        elif version < record["version"]:
            stale.append(record["id"])
        elif version > record["version"]:
            ahead.append(record["id"])

    # A partial listing proves what exists, never what does not. Deleting on the strength of
    # a page that failed to arrive is how reconciliation destroys the replica it repairs.
    source = {record["id"] for record in snapshot["records"]}
    extra = (
        [record["id"] for record in projection if record["id"] not in source]
        if snapshot["complete"]
        else []
    )

    clean = not (missing or stale or ahead or extra)

    return {
        "missing": missing,
        "stale": stale,
        "ahead": ahead,
        "extra": extra,
        "inSync": snapshot["complete"] and clean,
    }
