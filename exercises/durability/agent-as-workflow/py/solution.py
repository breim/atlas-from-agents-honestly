def port(plan: list, bounds: dict, workflow_id: str, config: dict) -> dict:
    errors = []

    for step in plan:
        # A model call cannot be replayed, so it is an activity. Everything follows from that.
        if step["kind"] == "workflow" and step["effect"] not in ("decision", "clock"):
            errors.append(
                f"{step['name']} is a {step['effect']} in workflow code; that is an activity"
            )
        # The deadline cannot read the clock. It is a run timeout the server enforces.
        if step["effect"] == "clock":
            errors.append(
                f"{step['name']} reads the clock; use the workflow run timeout instead"
            )
        # An activity's return value is journalled forever, so project inside the activity.
        if step["kind"] == "activity" and step.get("payloadBytes", 0) > config["maxPayloadBytes"]:
            errors.append(
                f"{step['name']} returns {step['payloadBytes']} bytes; "
                "truncate inside the activity"
            )

    activities = []
    for step in plan:
        if step["kind"] != "activity":
            continue
        activities.append(
            {
                "name": step["name"],
                # The workflow id is stable by construction, so the key is trivially correct.
                "idempotencyKey": f"{workflow_id}:{step['name']}",
                # A slow activity that does not heartbeat is declared timed out and retried
                # while still running, and you pay for both.
                "doubleBilled": step["effect"] == "model"
                and not step.get("heartbeats")
                and step.get("durationMs", 0) > config["activityTimeoutMs"],
            }
        )

    for activity in activities:
        if activity["doubleBilled"]:
            errors.append(
                f"{activity['name']} does not heartbeat and will be billed twice"
            )

    history_bytes = sum(
        step.get("payloadBytes", 0) for step in plan if step["kind"] == "activity"
    )
    if history_bytes > config["maxHistoryBytes"]:
        errors.append(
            f"the history reaches {history_bytes} bytes; hold a reference and keep "
            "messages outside"
        )

    return {
        "status": "rejected" if errors else "completed",
        "errors": errors,
        "historyBytes": history_bytes,
        "activities": activities,
        "bounds": {
            "steps": "yours",
            "cost": "yours",
            # Two of Part II's bounds stay yours; the deadline moves to the platform.
            "deadline": "platform",
        },
    }
