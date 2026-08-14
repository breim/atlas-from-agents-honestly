def _slowest(steps: list) -> int:
    return max((step["ms"] for step in steps), default=0)


def _elapsed_for(steps: list, mode: str, limit: int) -> int:
    if mode == "sequential":
        return sum(step["ms"] for step in steps)
    if mode == "parallel":
        return _slowest(steps)

    return sum(
        _slowest(steps[start : start + limit]) for start in range(0, len(steps), limit)
    )


def compose(steps: list, mode: str, limit: int) -> dict:
    return {
        # Declaration order, whatever order the work finished in.
        "results": [step["id"] for step in steps if step["ok"]],
        "failed": [step["id"] for step in steps if not step["ok"]],
        "elapsed": _elapsed_for(steps, mode, limit),
    }
