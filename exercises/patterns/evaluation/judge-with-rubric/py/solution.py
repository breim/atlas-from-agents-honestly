import math


def judge(scores: dict, rubric: list, threshold: int) -> dict:
    unaddressed: list = []
    vetoed: list = []
    weighted = 0
    weights = 0

    for entry in rubric:
        # An unscored criterion is a zero, not an exclusion from the denominator.
        if entry["criterion"] not in scores:
            unaddressed.append(entry["criterion"])

        score = scores.get(entry["criterion"], 0)
        if score < entry["min"]:
            vetoed.append(entry["criterion"])

        weighted += score * entry["weight"]
        weights += entry["weight"]

    total = 0 if weights == 0 else math.floor(weighted / weights + 0.5)
    passed = total >= threshold and not vetoed

    return {
        "total": total,
        "verdict": "pass" if passed else "fail",
        "unaddressed": unaddressed,
        "vetoed": vetoed,
    }
