import math


def _to_four_places(ratio: float) -> float:
    """floor(x + 0.5) rather than round(), so both tracks agree on halves."""
    return math.floor(ratio * 10000 + 0.5) / 10000


def collect(outcomes: list) -> dict:
    succeeded = [outcome for outcome in outcomes if outcome["ok"]]
    failed = [outcome["item"] for outcome in outcomes if not outcome["ok"]]

    if not failed:
        status = "complete"
    elif not succeeded:
        status = "failed"
    else:
        status = "partial"

    return {
        "status": status,
        "values": {outcome["item"]: outcome["value"] for outcome in succeeded},
        "failed": failed,
        "coverage": 1 if not outcomes else _to_four_places(len(succeeded) / len(outcomes)),
    }
