def run(events: list, max_events: int, keep_recent: int) -> dict:
    state = {"generation": 0, "summary": [], "recent": [], "events": 0}

    for event in events:
        state["recent"].append(event)
        while len(state["recent"]) > keep_recent:
            state["summary"].append(state["recent"].pop(0))

        state["events"] += 1
        if state["events"] >= max_events:
            state["generation"] += 1
            state["events"] = 0

    return state
