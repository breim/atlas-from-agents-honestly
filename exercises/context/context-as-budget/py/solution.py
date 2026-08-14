CONSTANTS = ("system", "schemas")


def _sum(items: list) -> int:
    return sum(item["tokens"] for item in items)


def _trim(items: list, allocation: int) -> tuple:
    """Evicts from the front of an already-ordered list until the rest fits."""
    kept = list(items)
    dropped = []
    while _sum(kept) > allocation and kept:
        dropped.append(kept.pop(0))
    return kept, dropped


def allocate(request: dict, budget: dict) -> dict:
    def allocation_of(claimant: str) -> int:
        return next(row for row in budget["rows"] if row["claimant"] == claimant)["allocation"]

    raw = {
        "system": request["system"],
        "schemas": request["schemas"],
        "documents": _sum(request["documents"]),
        "results": _sum(request["results"]),
        "history": _sum(request["history"]),
        "user": request["user"],
    }

    def measure(breakdown: dict, evicted: list, errors: list) -> dict:
        total = sum(breakdown.values())
        headroom = budget["window"] - budget["reserveOutput"] - total
        if errors:
            status = "failed-build"
        elif headroom < 0:
            status = "over"
        elif evicted:
            status = "trimmed"
        else:
            status = "ok"
        return {
            "status": status,
            "breakdown": breakdown,
            "total": total,
            "headroom": headroom,
            "evicted": evicted,
            "errors": errors,
        }

    # Constants are a code-review problem. Enforcing them at runtime admits nobody owns them.
    errors = [
        f"{claimant} is {raw[claimant]} tokens against an allocation of {allocation_of(claimant)}"
        for claimant in CONSTANTS
        if raw[claimant] > allocation_of(claimant)
    ]
    if errors:
        return measure(raw, [], errors)

    # Oldest facts first, then oldest turns, then the lowest-ranked documents.
    ordered = {
        "results": sorted(request["results"], key=lambda item: item["step"]),
        "history": sorted(request["history"], key=lambda item: item["turn"]),
        "documents": sorted(request["documents"], key=lambda item: -item["rank"]),
    }

    breakdown = dict(raw)
    evicted = []

    for claimant in budget["evictionOrder"]:
        allocation = allocation_of(claimant)

        if claimant == "user":
            if breakdown["user"] > allocation:
                evicted.append(
                    {
                        "claimant": claimant,
                        "id": "user-message",
                        "tokens": breakdown["user"] - allocation,
                    }
                )
                breakdown["user"] = allocation
            continue

        kept, dropped = _trim(ordered[claimant], allocation)
        for item in dropped:
            evicted.append(
                {"claimant": claimant, "id": item["id"], "tokens": item["tokens"]}
            )
        breakdown[claimant] = _sum(kept)

    return measure(breakdown, evicted, errors)
