def window(events: list, now: int, window_ms: int) -> list:
    edge = now - window_ms
    return [event["id"] for event in events if event["at"] >= edge]
