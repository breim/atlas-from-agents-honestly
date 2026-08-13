def run_timer(deadline: int, events: list, horizon: int) -> dict:
    current = deadline

    for event in events:
        if event["at"] >= current:
            return {"fired": True, "at": current}
        if event["kind"] == "resolve":
            return {"fired": False, "at": None}
        current = event["to"]

    if current <= horizon:
        return {"fired": True, "at": current}
    return {"fired": False, "at": None}
