ACTIVITY_WORK = ("model", "io", "interrupt")


def plan(graph: dict, runtime: dict) -> dict:
    errors = []
    warnings = []

    # The plugin is Python-only; TypeScript writes the workflow by hand.
    if runtime["language"] != "python":
        return {
            "status": "unsupported",
            "errors": [
                f"the plugin is python-only; write the workflow by hand in "
                f"{runtime['language']}"
            ],
            "warnings": [],
            "placement": [],
            "activityCount": 0,
            "workflowCount": 0,
            "checkpointer": "none",
        }

    old_python = runtime["pythonVersion"] < "3.11"
    needs_new = runtime["usesFunctionalApi"] or any(
        n["work"] == "interrupt" for n in graph["nodes"]
    )
    if old_python and needs_new:
        # It loads with a warning rather than failing, so the pause is silently absent.
        warnings.append(
            f"python {runtime['pythonVersion']} loads the plugin without interrupt "
            "or the functional API"
        )

    for node in graph["nodes"]:
        # execute_in cannot be defaulted, explicitly to prevent determinism bugs.
        if not node.get("executeIn"):
            errors.append(f"{node['name']} does not declare execute_in")
            continue
        if node["work"] in ACTIVITY_WORK and node["executeIn"] != "activity":
            errors.append(
                f"{node['name']} does {node['work']} work and must execute in an activity"
            )
        # The Store is unreachable from an activity node, and it fails at the point of use.
        if node.get("usesStore") and node["executeIn"] == "activity":
            errors.append(
                f"{node['name']} reads the store from an activity, which is unreachable there"
            )

    # Conditional edges always run in the workflow, so they must be async.
    for edge in graph["edges"]:
        if not edge["async"]:
            errors.append(
                f"the edge from {edge['from']} runs in the workflow and must be async"
            )

    placement = [
        {"node": n["name"], "executeIn": n["executeIn"]}
        for n in graph["nodes"]
        if n.get("executeIn")
    ]

    return {
        "status": "rejected" if errors else "ready",
        "errors": errors,
        "warnings": warnings,
        "placement": placement,
        "activityCount": len([p for p in placement if p["executeIn"] == "activity"]),
        "workflowCount": len([p for p in placement if p["executeIn"] == "workflow"]),
        # Temporal's history replaces the checkpointer rather than complementing it.
        "checkpointer": "temporal-history",
    }
