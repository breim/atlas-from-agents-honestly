import math


def reflect(rounds: list, threshold: float, max_rounds: int) -> dict:
    best = {"draft": "", "score": -math.inf}
    consumed = 0

    for round_ in rounds[:max_rounds]:
        consumed += 1
        if round_["score"] > best["score"]:
            best = round_
        if round_["score"] >= threshold:
            return {
                "draft": best["draft"],
                "score": best["score"],
                "rounds": consumed,
                "stopped": "threshold",
            }

    return {
        "draft": best["draft"],
        "score": best["score"],
        "rounds": consumed,
        "stopped": "budget",
    }
