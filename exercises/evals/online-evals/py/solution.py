from math import floor


def _bps(part: int, whole: int) -> int:
    return 0 if whole == 0 else floor(part * 10000 / whole + 0.5)


def _flagged(run: dict, policy: dict) -> bool:
    return any(run[name] for name in policy["always"])


def plan(runs: list, policy: dict) -> dict:
    # Systematic by position rather than random, so the same traffic yields the same plan.
    scored = [
        run
        for index, run in enumerate(runs)
        if index % policy["baselineEveryNth"] == 0 or _flagged(run, policy)
    ]
    scored_ids = {run["id"] for run in scored}

    rate_bps = {"overall": _bps(len(scored), len(runs))}

    plain = [run for run in runs if not _flagged(run, policy)]
    rate_bps["plain"] = _bps(
        sum(1 for run in plain if run["id"] in scored_ids), len(plain)
    )

    for name in policy["always"]:
        stratum = [run for run in runs if run[name]]
        rate_bps[name] = _bps(
            sum(1 for run in stratum if run["id"] in scored_ids), len(stratum)
        )

    # A shadowed agent runs with writes disabled, so a shadow write proves nothing.
    requested = [run for run in runs if run["requestsWrite"]]
    unvalidated = [run for run in requested if run["stage"] == "shadow"]
    validated = len(requested) - len(unvalidated)

    return {
        "scored": [run["id"] for run in scored],
        "rateBps": rate_bps,
        "writes": {
            "requested": len(requested),
            "validated": validated,
            "coverageBps": _bps(validated, len(requested)),
            "unvalidated": [run["id"] for run in unvalidated],
        },
    }
