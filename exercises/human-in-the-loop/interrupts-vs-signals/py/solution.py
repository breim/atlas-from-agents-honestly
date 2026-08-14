def _flatten(steps: list) -> list:
    # Re-entry is from the top of the outermost node, so a subgraph is not a boundary.
    leaves = []
    for step in steps:
        if step["kind"] == "subgraph":
            leaves.extend(_flatten(step["steps"]))
        else:
            leaves.append(step)
    return leaves


def run(program: dict, mechanism: str) -> dict:
    leaves = _flatten(program["steps"])
    pauses = sum(1 for leaf in leaves if leaf["kind"] == "interrupt")
    executions = pauses + 1 if mechanism == "langgraph" else 1

    effects = []
    for pass_index in range(executions):
        stop_at = pass_index if mechanism == "langgraph" else pauses
        resumed = 0
        for leaf in leaves:
            if leaf["kind"] == "interrupt":
                if resumed == stop_at:
                    break
                resumed += 1
                continue
            effects.append(leaf["name"])

    duplicated = [
        name for name in dict.fromkeys(effects) if effects.count(name) > 1
    ]

    return {"effects": effects, "executions": executions, "duplicated": duplicated}
