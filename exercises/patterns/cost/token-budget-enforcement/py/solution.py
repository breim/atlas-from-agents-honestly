def enforce(calls: list, budget: int) -> dict:
    result: dict = {"executed": [], "refused": [], "spent": 0}

    for call in calls:
        if result["spent"] + call["tokens"] > budget:
            result["refused"].append(call["id"])
            continue

        result["spent"] += call["tokens"]
        result["executed"].append(call["id"])

    return result
