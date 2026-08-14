def run(plan: list, catalogue: list, world: dict, config: dict) -> dict:
    by_name = {tool["name"]: tool for tool in catalogue}
    errors = []

    # A write without a declared compensation cannot participate, and that is checkable.
    for step in plan:
        tool = by_name.get(step["tool"])
        if tool is None:
            errors.append(f"{step['tool']} is not in the catalogue")
            continue
        if tool["reversibility"] == "reversible" and not tool["compensation"]:
            errors.append(f"{tool['name']} is reversible but declares no compensation")

    # Order by reversibility: fallible before the pivot, irreversible after.
    pivot_at = next(
        (i for i, s in enumerate(plan) if s["tool"] == config["pivot"]), -1
    )
    if pivot_at >= 0:
        for index, step in enumerate(plan[:pivot_at]):
            tool = by_name.get(step["tool"])
            if tool and tool["reversibility"] != "reversible":
                errors.append(
                    f"{tool['name']} is {tool['reversibility']} and sits at {index}, "
                    "before the pivot"
                )

    if errors:
        return {
            "status": "invalid",
            "errors": errors,
            "applied": [],
            "unwound": [],
            "incidents": [],
        }

    applied = []
    failed_at = -1

    for index, step in enumerate(plan):
        attempts = 0
        ok = False
        while attempts < config["maxAttempts"]:
            attempts += 1
            # A business rejection is not transient. Retrying it changes nothing.
            if step["outcome"] == "rejected":
                break
            if step["outcome"] == "ok" or attempts == config["maxAttempts"]:
                ok = step["outcome"] == "ok"
                break
        applied.append({"tool": step["tool"], "attempts": attempts})
        if not ok:
            failed_at = index
            break

    if failed_at == -1:
        return {
            "status": "completed",
            "errors": [],
            "applied": applied,
            "unwound": [],
            "incidents": [],
        }

    # Past the pivot, the correct response to failure is to finish, not to reverse.
    if pivot_at >= 0 and failed_at > pivot_at:
        return {
            "status": "forward-only",
            "errors": [],
            "applied": applied,
            "unwound": [],
            "incidents": [],
        }

    # Unwind in reverse, only what actually succeeded.
    unwound = []
    incidents = []
    for step in reversed(plan[:failed_at]):
        tool = by_name[step["tool"]]
        if not tool["compensation"]:
            unwound.append({"step": tool["name"], "compensation": "", "status": "none"})
            incidents.append(f"{tool['name']} ran and cannot be reversed")
            continue
        outcome = world.get(tool["compensation"], "ok")
        if outcome == "ok":
            unwound.append(
                {
                    "step": tool["name"],
                    "compensation": tool["compensation"],
                    "status": "compensated",
                }
            )
            continue
        # One failed compensation raises an incident and does not stop the others.
        unwound.append(
            {
                "step": tool["name"],
                "compensation": tool["compensation"],
                "status": "failed",
            }
        )
        incidents.append(f"{tool['compensation']} failed; a human owns {tool['name']}")

    return {
        "status": "unwound",
        "errors": [],
        "applied": applied,
        "unwound": unwound,
        "incidents": incidents,
    }
