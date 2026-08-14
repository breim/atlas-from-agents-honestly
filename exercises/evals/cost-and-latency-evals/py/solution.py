from math import ceil, floor


def _per(total: int, count: int):
    return None if count == 0 else floor(total / count + 0.5)


def _bps(part: int, whole: int) -> int:
    return 0 if whole == 0 else floor(part * 10000 / whole + 0.5)


def _p95(values: list):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[ceil(95 * len(ordered) / 100) - 1]


def _within(measured, budget: int) -> bool:
    return measured is None or measured <= budget


def evaluate(runs: list, config: dict) -> dict:
    budgets = config["budgets"]
    baseline = config["baseline"]

    # Every cent on top; only the runs that bought something on the bottom.
    spend = sum(run["costCents"] for run in runs)
    resolved = sum(1 for run in runs if run["outcome"] == "resolved")

    # A three-day approval is the system working, not latency.
    measured = [run["totalMs"] - run["humanWaitMs"] for run in runs]

    cost_per_outcome = _per(spend, resolved)
    ttft_p95 = _p95([run["ttftMs"] for run in runs])
    total_p95 = _p95(measured)
    over_ceiling_bps = _bps(
        sum(1 for ms in measured if ms > budgets["hardCeilingMs"]), len(runs)
    )

    resolved_rate_bps = _bps(resolved, len(runs))
    quality = resolved_rate_bps >= baseline["resolvedRateBps"] - config["noiseBandBps"]
    cost = cost_per_outcome is not None and cost_per_outcome <= floor(
        baseline["costPerOutcomeCents"] * 110 / 100
    )
    latency = (
        _within(ttft_p95, budgets["ttftP95Ms"])
        and _within(total_p95, budgets["totalP95Ms"])
        and over_ceiling_bps <= budgets["overCeilingBps"]
    )

    return {
        "resolvedRateBps": resolved_rate_bps,
        "costPerOutcomeCents": cost_per_outcome,
        "costPerAttemptCents": _per(spend, len(runs)),
        "ttftP95Ms": ttft_p95,
        "totalP95Ms": total_p95,
        "overCeilingBps": over_ceiling_bps,
        "gates": {
            "quality": quality,
            "cost": cost,
            "latency": latency,
            "pass": quality and cost and latency,
        },
    }
