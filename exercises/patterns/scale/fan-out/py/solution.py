def fan_out(items: list, limit: int, failures: list) -> dict:
    failing = set(failures)
    waves = [items[start : start + limit] for start in range(0, len(items), limit)]

    return {
        "results": [{"item": item, "ok": item not in failing} for item in items],
        "waves": waves,
    }
