from math import floor


def plan(request: dict, config: dict) -> dict:
    owners = config["ownership"].get(request["failureClass"], [])

    # Every layer that does not own this class gets one attempt, not zero: one attempt
    # is the call itself. Two owners is not defence in depth, it is multiplication.
    layers = [
        {
            "name": layer["name"],
            "attempts": layer["attempts"] if layer["name"] in owners else 1,
        }
        for layer in config["layers"]
    ]

    # The fourth layer is not in the config and multiplies anyway.
    total_calls = request["modelRetries"]
    for layer in layers:
        total_calls *= layer["attempts"]

    # The run owns the deadline; the call gets a share of what is left, never all of it.
    share = floor(request["remainingMs"] * config["reserveBps"] / 10000)
    timeout_ms = 0 if request["remainingMs"] <= 0 else min(request["preferredTimeoutMs"], share)

    used_bps = (
        0
        if request["callsInWindow"] == 0
        else floor(request["retriesInWindow"] * 10000 / request["callsInWindow"] + 0.5)
    )

    if not owners:
        reason = "not_retryable"
    elif request["remainingMs"] <= 0:
        reason = "deadline_exceeded"
    elif request["attemptsUsed"] >= config["maxAttemptsPerRun"]:
        reason = "run_attempts_exhausted"
    elif used_bps >= config["retryBudgetBps"]:
        reason = "retry_budget_exhausted"
    else:
        reason = None

    return {
        "layers": layers,
        "totalCalls": total_calls,
        "multiplied": len(owners) > 1,
        "timeoutMs": timeout_ms,
        "retryAdmitted": reason is None,
        "reason": reason,
    }
