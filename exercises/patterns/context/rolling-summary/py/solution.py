def append(state: dict, turn_id: str, keep_recent: int) -> dict:
    recent = [*state["recent"], turn_id]
    overflow = max(0, len(recent) - keep_recent)

    return {
        "summary": [*state["summary"], *recent[:overflow]],
        "recent": recent[overflow:],
    }
