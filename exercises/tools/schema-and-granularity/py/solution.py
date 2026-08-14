def assess(tool: dict, known_fields: list, max_params: int) -> dict:
    issues: list = []

    if not tool["effects"]:
        issues.append(f"no_effect:{tool['name']}")
    elif len(tool["effects"]) > 1:
        issues.append(f"multiple_effects:{tool['name']}")

    for param in tool["params"]:
        # Only required parameters are a problem: an optional one can simply be omitted.
        if param["required"] and param["name"] not in known_fields:
            issues.append(f"undeterminable_param:{param['name']}")

    if len(tool["params"]) > max_params:
        issues.append(f"too_many_params:{tool['name']}")

    return {"verdict": "ok" if not issues else "revise", "issues": issues}
