def dispatch(calls: list, catalogue: list, policy: dict) -> dict:
    by_name = {tool["name"]: tool for tool in catalogue}

    # The class is a property of the handler, not of the name.
    mislabelled = [
        tool["name"]
        for tool in catalogue
        if tool["class"] >= 2
        and any(tool["name"].startswith(p) for p in policy["readPrefixes"])
    ]

    def class_of(call: dict) -> int:
        tool = by_name.get(call["name"])
        return tool["class"] if tool else 0

    def judge(call: dict) -> dict:
        tool = by_name.get(call["name"])
        rank = tool["class"] if tool else 0
        base = {
            "id": call["id"],
            "name": call["name"],
            "class": rank,
            "parallel": 1 <= rank <= 2,
            # Free for a pure read, wrong for an observed read, for a write only if declared.
            "retriable": True
            if rank == 1
            else False
            if rank <= 2
            else bool(tool and tool.get("idempotent")),
            "cacheable": rank == 1,
        }

        def fail(reason: str) -> dict:
            return {**base, "status": "error", "reason": reason}

        if tool is None:
            return fail(f"no tool named {call['name']}")

        if rank >= 3:
            # A filter is a program, and one that matches more rows than the author pictured
            # is the entire incident category.
            found = next(
                (a for a in tool["arguments"] if a["kind"] == "filter"), None
            )
            if found:
                return fail(
                    f"a write takes identifiers, never a filter: {found['name']}"
                )

            # The ceiling lives here, next to the entitlement check, not in the schema.
            for argument in tool["arguments"]:
                if argument["kind"] != "amount" or "ceiling" not in tool:
                    continue
                value = call["input"][argument["name"]]
                if value > tool["ceiling"]:
                    return fail(
                        f"{argument['name']} {value} exceeds the ceiling of {tool['ceiling']}"
                    )

        if call.get("fails"):
            return fail(call["fails"])
        return {**base, "status": "ok", "reason": None}

    order = []
    results = []
    skipped = []

    # Reads concurrently, and every result comes back.
    for call in [c for c in calls if class_of(c) <= 2]:
        order.append(call["id"])
        results.append(judge(call))

    # Writes one at a time, stopping at the first failure.
    stopped = False
    for call in [c for c in calls if class_of(c) >= 3]:
        if stopped:
            skipped.append(call["id"])
            continue
        order.append(call["id"])
        outcome = judge(call)
        results.append(outcome)
        if outcome["status"] == "error":
            stopped = True

    return {
        "order": order,
        "results": results,
        "skipped": skipped,
        "mislabelled": mislabelled,
    }
