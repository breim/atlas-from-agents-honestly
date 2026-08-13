def check(tool: str, trust: str, grants: list, tools: dict) -> dict:
    if tool not in grants:
        return {"allowed": False, "reason": "not_granted"}
    if tools.get(tool) == "write" and trust == "external":
        return {"allowed": False, "reason": "taint_ceiling"}

    return {"allowed": True, "reason": None}
