def escalate(kind: str, ladder: list, outcomes: list) -> dict:
    capable = [rung for rung in ladder if kind in rung["handles"]]
    result = {"path": [], "resolved": False, "cost": 0}

    for attempt, rung in enumerate(capable):
        result["path"].append(rung["rung"])
        result["cost"] += rung["cost"]

        if attempt < len(outcomes) and outcomes[attempt] == "ok":
            result["resolved"] = True
            return result

    return result
