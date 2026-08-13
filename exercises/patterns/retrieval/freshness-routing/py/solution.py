def route(cached_at, now: int, max_age: int) -> str:
    if cached_at is None:
        return "live"
    return "cache" if now - cached_at < max_age else "live"
