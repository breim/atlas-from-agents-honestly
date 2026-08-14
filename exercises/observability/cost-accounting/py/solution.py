from math import ceil, floor


def _bps(part: int, whole: int) -> int:
    return 0 if whole == 0 else floor(part * 10000 / whole + 0.5)


def _rank(ordered: list, percentile: int):
    return None if not ordered else ordered[ceil(percentile * len(ordered) / 100) - 1]


def account(calls: list, prices: dict, invoice: dict) -> dict:
    # The version recorded on the call, not today's. History does not reprice itself.
    def cost(call: dict) -> int:
        rates = prices[call["priceVersion"]][call["model"]]
        return (
            call["inputTokens"] * rates["input"]
            + call["cachedInputTokens"] * rates["cachedInput"]
            + call["outputTokens"] * rates["output"]
        )

    priced = [{"id": call["id"], "costMicros": cost(call)} for call in calls]
    real = [call for call in calls if not call["synthetic"]]

    totals = {
        "total": sum(cost(call) for call in calls),
        "productive": sum(cost(call) for call in real if call["productive"]),
        "unproductive": sum(cost(call) for call in real if not call["productive"]),
        "synthetic": sum(cost(call) for call in calls if call["synthetic"]),
    }

    cached = sum(call["cachedInputTokens"] for call in real)
    uncached = sum(call["inputTokens"] for call in real)

    # Heavy-tailed, and per run rather than per call, because a run is the unit that loops.
    run_ids = list(dict.fromkeys(call["runId"] for call in real))
    ordered = sorted(
        sum(cost(call) for call in real if call["runId"] == run_id) for run_id in run_ids
    )
    spend = sum(ordered)
    top = ordered[len(ordered) - ceil(len(ordered) / 100) :] if ordered else []

    if invoice["micros"] == 0:
        gap_bps = 0 if totals["total"] == 0 else 10000
    else:
        gap_bps = _bps(abs(totals["total"] - invoice["micros"]), invoice["micros"])

    return {
        "priced": priced,
        "totals": totals,
        "cacheHitBps": _bps(cached, cached + uncached),
        "runCostMicros": {
            "p50": _rank(ordered, 50),
            "p90": _rank(ordered, 90),
            "p99": _rank(ordered, 99),
            "max": _rank(ordered, 100),
        },
        "topRunsShareBps": _bps(sum(top), spend),
        "reconciliation": {
            "recordedMicros": totals["total"],
            "gapBps": gap_bps,
            "reconciles": gap_bps <= invoice["toleranceBps"],
        },
    }
