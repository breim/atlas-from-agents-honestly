def admit(arrivals: list, capacity: int, refill_ms_per_token: int) -> dict:
    result: dict = {"admitted": [], "rejected": []}
    tokens = float(capacity)
    last = None

    for at in arrivals:
        if last is not None:
            tokens = min(capacity, tokens + (at - last) / refill_ms_per_token)
        last = at

        if tokens >= 1:
            tokens -= 1
            result["admitted"].append(at)
        else:
            result["rejected"].append(at)

    return result
