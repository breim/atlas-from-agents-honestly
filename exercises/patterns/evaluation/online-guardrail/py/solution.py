def watch(outcomes: list, window: int, floor_bps: int) -> dict:
    worst = None

    for end in range(window - 1, len(outcomes)):
        chunk = outcomes[end - window + 1 : end + 1]
        bps = chunk.count("ok") * 10000 // window

        worst = bps if worst is None else min(worst, bps)
        if bps < floor_bps:
            return {"tripped": True, "at": end, "worstBps": worst}

    return {"tripped": False, "at": None, "worstBps": worst}
