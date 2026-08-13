RETRYABLE = ("rate_limit", "server_error", "overloaded")


def call(attempt, max_attempts: int) -> dict:
    last_error = None

    for attempts in range(1, max_attempts + 1):
        outcome = attempt()
        if outcome == "ok":
            return {"status": "ok", "attempts": attempts, "lastError": None}

        last_error = outcome
        if outcome not in RETRYABLE:
            return {"status": "failed", "attempts": attempts, "lastError": last_error}

    return {"status": "exhausted", "attempts": max_attempts, "lastError": last_error}
