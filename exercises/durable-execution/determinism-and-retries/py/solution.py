def _backoff(policy: dict, attempt: int) -> int:
    growth = policy["initialIntervalMs"] * policy["backoffCoefficient"] ** (attempt - 1)
    return min(growth, policy["maximumIntervalMs"])


def execute(policy: dict, outcomes: list) -> dict:
    elapsed_ms = 0
    last_error = None

    for attempts, outcome in enumerate(outcomes, start=1):
        elapsed_ms += outcome["durationMs"]

        if outcome["error"] is None:
            return {
                "status": "completed",
                "attempts": attempts,
                "elapsedMs": elapsed_ms,
                "lastError": None,
            }
        last_error = outcome["error"]

        # A rejection that will fail identically every time is not worth an attempt.
        if last_error in policy["nonRetryable"]:
            status = "non_retryable"
        elif policy["maximumAttempts"] != 0 and attempts >= policy["maximumAttempts"]:
            status = "attempts_exhausted"
        elif elapsed_ms + _backoff(policy, attempts) >= policy["scheduleToCloseMs"]:
            status = "deadline_exceeded"
        else:
            elapsed_ms += _backoff(policy, attempts)
            continue

        return {
            "status": status,
            "attempts": attempts,
            "elapsedMs": elapsed_ms,
            "lastError": last_error,
        }

    # Nothing decided it, so it is still going. This is what an unlimited policy looks like.
    return {
        "status": "retrying",
        "attempts": len(outcomes),
        "elapsedMs": elapsed_ms,
        "lastError": last_error,
    }
