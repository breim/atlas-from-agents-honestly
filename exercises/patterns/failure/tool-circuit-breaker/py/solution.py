def run(calls: list, threshold: int, cooldown_ms: int) -> dict:
    breaker: dict = {"states": [], "reached": []}
    is_open = False
    opened_at = 0
    failures = 0

    for call in calls:
        probing = is_open and call["at"] - opened_at >= cooldown_ms
        served = ("half-open" if probing else "open") if is_open else "closed"
        breaker["states"].append(served)

        if served == "open":
            continue
        breaker["reached"].append(call["at"])

        if call["outcome"] == "ok":
            is_open = False
            failures = 0
            continue

        failures = threshold if served == "half-open" else failures + 1
        if failures >= threshold:
            is_open = True
            opened_at = call["at"]

    return breaker
