def live(events: list, config: dict, code_version: str) -> dict:
    batches = []
    recycles = []
    warnings = []

    state = {"buffer": [], "events": 0, "bytes": 0, "status": "open"}

    # Each new event restarts the quiet window; the batch fires when it finally elapses.
    def flush(at: int) -> None:
        if not state["buffer"]:
            return
        batches.append({"actedAt": at, "events": [e["at"] for e in state["buffer"]]})
        state["buffer"] = []

    for index, event in enumerate(events):
        # Timers must be absolute: a relative sleep means the deadline never arrives.
        if event["at"] >= config["deadlineAt"]:
            flush(event["at"])
            state["status"] = "expired"
            break

        state["events"] += 1
        state["bytes"] += event["bytes"]

        if event["kind"] == "close":
            flush(event["at"])
            state["status"] = "closed"
            break

        if event["kind"] == "message":
            # People type in bursts. Acting on each event separately contradicts itself.
            state["buffer"].append(event)
            following = events[index + 1] if index + 1 < len(events) else None
            quiet = (
                following is None
                or following["at"] - event["at"] >= config["quietWindowMs"]
            )
            if quiet:
                flush(event["at"] + config["quietWindowMs"])

        # Recycle with headroom: draining generates events, so the ceiling is fatal.
        if (
            state["events"] >= config["historyEventCap"] - config["headroomEvents"]
            or state["bytes"] >= config["historyByteCap"]
        ):
            drained = len(state["buffer"])
            flush(event["at"])
            recycles.append(
                {
                    "at": event["at"],
                    "eventsBefore": state["events"],
                    "carried": config["carry"],
                    "drained": drained,
                }
            )
            if config["carry"] == "transcript":
                warnings.append(
                    f"carrying the raw transcript across continue-as-new at {event['at']}"
                )
            state["events"] = 0
            state["bytes"] = 0

    if state["status"] == "open":
        flush(events[-1]["at"] + config["quietWindowMs"] if events else 0)

    if state["status"] == "open" and events:
        warnings.append(
            f"still open on {code_version}; an entity workflow needs a defined end"
        )

    return {
        "status": state["status"],
        "batches": batches,
        "recycles": recycles,
        "historyEvents": state["events"],
        "historyBytes": state["bytes"],
        "warnings": warnings,
    }
