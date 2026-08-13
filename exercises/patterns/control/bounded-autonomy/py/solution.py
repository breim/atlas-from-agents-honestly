def _refuse(action: dict, budget: dict, taken: int, spent: int):
    if action["tool"] not in budget["tools"]:
        return "tool_not_granted"
    if taken >= budget["actions"]:
        return "action_budget_exhausted"
    if spent + action["cents"] > budget["cents"]:
        return "spend_budget_exhausted"
    return None


def enforce(actions: list, budget: dict) -> dict:
    result: dict = {"allowed": [], "denied": []}
    taken = 0
    spent = 0

    for action in actions:
        reason = _refuse(action, budget, taken, spent)
        if reason:
            result["denied"].append({"tool": action["tool"], "reason": reason})
            continue

        taken += 1
        spent += action["cents"]
        result["allowed"].append(action["tool"])

    return result
