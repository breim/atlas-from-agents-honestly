def _disqualify(step: dict, config: dict):
    if step["kind"] == "model":
        return "model_call"
    if step["needsHeartbeat"]:
        return "needs_heartbeat"
    # Nothing external reaches the workflow while a local activity runs.
    if step["needsSignals"]:
        return "must_stay_reachable"
    if step["durationMs"] > config["localBudgetMs"]:
        return "too_long"
    return None


def plan(steps: list, config: dict) -> dict:
    placements = []
    for step in steps:
        reason = _disqualify(step, config)
        if reason:
            mode = "activity"
        elif not step["onEntryPath"]:
            # Off the entry path there is a model call ahead to hide the round trip behind.
            mode, reason = "activity", "off_the_entry_path"
        else:
            mode, reason = "local", "short_and_on_the_entry_path"
        placements.append({"name": step["name"], "mode": mode, "reason": reason})

    entry_latency_ms = sum(
        step["durationMs"]
        + (config["roundTripMs"] if placement["mode"] == "activity" else 0)
        for step, placement in zip(steps, placements)
        if step["onEntryPath"]
    )

    return {"placements": placements, "entryLatencyMs": entry_latency_ms}
