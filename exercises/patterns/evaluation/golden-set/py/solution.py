import math


def score(golden: list, answers: dict) -> dict:
    result: dict = {"passed": [], "failed": [], "missing": [], "rate": 0}

    for entry in golden:
        if entry["id"] not in answers:
            result["missing"].append(entry["id"])

        correct = answers.get(entry["id"]) == entry["expected"]
        result["passed" if correct else "failed"].append(entry["id"])

    if not golden:
        result["rate"] = 1
    else:
        result["rate"] = math.floor(len(result["passed"]) / len(golden) * 10000 + 0.5) / 10000

    return result
