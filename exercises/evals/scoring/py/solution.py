from math import floor


def compare(trials: list) -> dict:
    # A trial that flipped told you about the judge's position, not about the candidates.
    consistent = [t for t in trials if t["forward"] == t["reverse"]]
    flipped = [t for t in trials if t["forward"] != t["reverse"]]

    a = sum(1 for t in consistent if t["forward"] == "a")
    b = len(consistent) - a

    consistency_bps = (
        0 if not trials else floor(len(consistent) * 10000 / len(trials) + 0.5)
    )

    return {
        "a": a,
        "b": b,
        "winner": "tie" if a == b else ("a" if a > b else "b"),
        "inconsistent": [t["id"] for t in flipped],
        "consistencyBps": consistency_bps,
        "positionBias": {
            "first": sum(1 for t in flipped if t["forward"] == "a"),
            "second": sum(1 for t in flipped if t["forward"] == "b"),
        },
    }
