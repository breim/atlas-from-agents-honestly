def retry(failures: int, policy: dict) -> dict:
    fast = [0 if i == 0 else policy["fastMs"] for i in range(policy["fastAttempts"])]
    full = fast + [policy["slowMs"]] * policy["slowAttempts"]

    attempts = min(failures + 1, len(full))

    return {
        "schedule": full[:attempts],
        "attempts": attempts,
        "gaveUp": failures >= len(full),
    }
