import math


def _bps(numerator: int, denominator: int) -> int:
    if denominator == 0:
        return 0
    return math.floor(numerator * 10000 / denominator + 0.5)


def score(retrieved: list, relevant: list, k: int) -> dict:
    top = retrieved[:k]
    wanted = set(relevant)
    found = [doc for doc in top if doc in wanted]

    first_hit = next((i for i, doc in enumerate(top) if doc in wanted), None)

    return {
        # A query with nothing relevant cannot fail to recall it.
        "recallBps": 10000 if not relevant else _bps(len(found), len(relevant)),
        "precisionBps": _bps(len(found), len(top)),
        "rrBps": 0 if first_hit is None else _bps(1, first_hit + 1),
    }
