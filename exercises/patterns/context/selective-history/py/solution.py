def select(history: list, threshold: float, keep_last: int) -> list:
    tail_start = max(0, len(history) - keep_last)

    return [
        entry["id"]
        for index, entry in enumerate(history)
        if index >= tail_start or entry["score"] >= threshold
    ]
