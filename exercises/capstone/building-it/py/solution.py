def review(build: dict, questions: list, policy: dict) -> dict:
    errors = []

    # Nine tools, not nineteen. Every tool is a permission and a description billed each turn.
    if len(build["tools"]) > policy["maxTools"]:
        errors.append(
            f"{len(build['tools'])} tools exceeds the {policy['maxTools']} the "
            "catalogue can carry"
        )

    for tool in build["tools"]:
        # Removing a parameter beats validating one.
        for argument in tool["args"]:
            if argument in policy["forbiddenArgs"]:
                errors.append(
                    f"{tool['name']} takes {argument}, which should be derived rather "
                    "than validated"
                )
        # Every class 4-5 tool ships with a paired read.
        if tool["klass"] >= 4 and not tool["pairedRead"]:
            errors.append(
                f"{tool['name']} is class {tool['klass']} and ships no paired read"
            )

    # Model calls and tool calls are always activities; workflow code decides.
    for node in build["nodes"]:
        if node["work"] == "decide" and node["placement"] != "workflow":
            errors.append(f"{node['name']} decides and should be workflow code")
        if node["work"] != "decide" and node["placement"] != "activity":
            errors.append(
                f"{node['name']} does {node['work']} work and must be an activity"
            )

    # The poisoned article can still rank first and still cannot reach a write tool.
    if not build["corpusSplitByTrust"]:
        errors.append("the corpus is not split by trust")

    # Put the tenant in the workflow id: structural tenancy and queue routing at once.
    if build["tenantId"] not in build["workflowId"]:
        errors.append("the workflow id does not carry the tenant")

    # Route before retrieving: four systems, four strategies.
    routing = [
        {"question": q["id"], "retriever": policy["routes"].get(q["kind"])}
        for q in questions
    ]
    for route in routing:
        if not route["retriever"]:
            errors.append(f"{route['question']} has no retriever for its kind")

    return {
        "status": "blocked" if errors else "shippable",
        "errors": errors,
        "routing": routing,
        "activities": len([n for n in build["nodes"] if n["placement"] == "activity"]),
        "workflowNodes": len([n for n in build["nodes"] if n["placement"] == "workflow"]),
    }
