def record(run: dict, policy: dict, draw_bps: int) -> dict:
    present = set()
    for span in run["spans"]:
        present.update(span["fields"])

    # Eight questions a trace must answer alone.
    unanswered = [q for q in policy["questions"] if q not in present]

    warnings = []

    # Without a truncation flag, a cut field and an ignored field look identical.
    for span in run["spans"]:
        if span["fields"].get("resultTruncated") is True and "truncatedAtBytes" not in span["fields"]:
            warnings.append(f"{span['id']} says it truncated without saying where")

    # The business entity is the correlation ID, so everything joins without a mapping table.
    if not run["correlationId"]:
        warnings.append("the run carries no correlation id, so nothing joins to it")

    # Metadata and a hash to the backend; full payloads to cheap storage.
    for span in run["spans"]:
        if span["payloadBytes"] > 0 and span["contentHash"] is None:
            warnings.append(
                f"{span['id']} stores a payload with no hash, so nothing joins or verifies it"
            )

    payload_bytes = sum(span["payloadBytes"] for span in run["spans"])
    backend_bytes = len(run["spans"]) * 200
    if backend_bytes > policy["maxBackendBytes"]:
        warnings.append(
            f"the backend holds {backend_bytes} bytes against a budget of "
            f"{policy['maxBackendBytes']}"
        )

    # Sample the boring and keep the interesting.
    if run["outcome"] in policy["alwaysKeep"]:
        kept_because = run["outcome"]
    elif run["latencyMs"] > policy["outlierLatencyMs"]:
        kept_because = "outlier"
    elif draw_bps < policy["sampleBps"]:
        kept_because = "sampled"
    else:
        kept_because = "dropped"

    return {
        "status": "incomplete" if unanswered else "answerable",
        "unanswered": unanswered,
        "sampled": kept_because != "dropped",
        "keptBecause": kept_because,
        "backendBytes": backend_bytes,
        "payloadBytes": payload_bytes,
        "warnings": warnings,
    }
