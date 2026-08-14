import math


def optimise(rounds: list, threshold: int, max_rounds: int) -> dict:
    best = {"draft": "", "score": -math.inf}
    consumed = 0
    previous = None

    for round_ in rounds[:max_rounds]:
        consumed += 1
        if round_["score"] > best["score"]:
            best = {"draft": round_["draft"], "score": round_["score"]}

        def stop(stopped: str) -> dict:
            return {
                "best": best["draft"],
                "score": best["score"],
                "rounds": consumed,
                "stopped": stopped,
            }

        if round_["score"] >= threshold:
            return stop("converged")
        # Feedback that repeats means the loop has stopped learning.
        if previous is not None and round_["feedback"] == previous:
            return stop("stalled")
        previous = round_["feedback"]

    return {
        "best": best["draft"],
        "score": best["score"],
        "rounds": consumed,
        "stopped": "budget",
    }
