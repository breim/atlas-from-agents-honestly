def serve(request: dict, ladder: list) -> dict:
    attempted = []
    skipped = []

    for index, rung in enumerate(ladder):
        # Failing fast is the whole point of the open state.
        if rung["name"] in request["open"]:
            skipped.append({"name": rung["name"], "why": "breaker_open"})
            continue
        # High-stakes work escalates rather than accepting the cheapest rung answering.
        if request["tier"] > rung["maxTier"]:
            skipped.append({"name": rung["name"], "why": "tier_too_high"})
            continue

        attempted.append(rung["name"])
        outcome = request["behaviour"].get(rung["name"])

        if outcome == "ok":
            return {
                "outcome": "served",
                "servedBy": rung["name"],
                "degraded": index > 0,
                "attempted": attempted,
                "skipped": skipped,
                "error": None,
            }

        # Only a transient failure falls through. A refusal is not a capacity problem.
        if outcome != "transient":
            return {
                "outcome": "halted",
                "servedBy": None,
                "degraded": False,
                "attempted": attempted,
                "skipped": skipped,
                "error": outcome,
            }

    return {
        "outcome": "escalate",
        "servedBy": None,
        "degraded": False,
        "attempted": attempted,
        "skipped": skipped,
        "error": "no_capacity",
    }
