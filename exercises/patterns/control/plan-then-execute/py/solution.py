def _validate(plan: list, tools: list):
    """Returns the first problem with the plan, or None when it is safe to run."""
    ids: set = set()
    for step in plan:
        if step["id"] in ids:
            return f"duplicate_step: {step['id']}"
        ids.add(step["id"])

    satisfied: set = set()
    for step in plan:
        if step["tool"] not in tools:
            return f"unknown_tool: {step['tool']}"
        for need in step["needs"]:
            if need not in ids:
                return f"unknown_dependency: {need}"
            if need not in satisfied:
                return f"dependency_not_yet_satisfied: {need}"
        satisfied.add(step["id"])

    return None


def run(plan: list, tools: list) -> dict:
    error = _validate(plan, tools)
    if error:
        return {"ok": False, "error": error, "executed": []}

    return {"ok": True, "executed": [step["id"] for step in plan]}
