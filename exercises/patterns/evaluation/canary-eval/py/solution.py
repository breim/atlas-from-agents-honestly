def decide(samples: int, rate: int, policy: dict) -> dict:
    if samples < policy["minSamples"]:
        return {"action": "hold", "reason": "insufficient_samples"}
    if rate >= policy["baseline"]:
        return {"action": "promote", "reason": "at_or_above_baseline"}
    if rate >= policy["baseline"] - policy["tolerance"]:
        return {"action": "hold", "reason": "within_tolerance"}

    return {"action": "rollback", "reason": "below_tolerance"}
