def govern(grants: list, run: dict, policy: dict) -> dict:
    by_tool = {grant["tool"]: grant for grant in grants}
    findings = []

    for grant in grants:
        # An agent chooses at runtime, so every unused grant is now reachable.
        if not grant["usedInLast90Days"]:
            findings.append(
                f"{grant['tool']} was not used in ninety days and is still granted"
            )
        # Most implementations scope only the tool.
        for scope in policy["requiredScopes"]:
            if scope not in grant["argumentScopes"]:
                findings.append(f"{grant['tool']} is not scoped by {scope}")
        # Aggregate caps stop the slow attack that per-call caps miss.
        if grant["maxPerCall"] is not None and grant["maxPerRun"] is None:
            findings.append(f"{grant['tool']} caps each call and not the run")
        # A dynamic catalogue invalidates a point-in-time audit.
        if grant["appearedAfterAudit"]:
            findings.append(
                f"{grant['tool']} appeared after the audit and is denied by default"
            )
        # Unattended execution is a permission even though it does not look like one.
        if grant["unattended"] and not run["attended"]:
            findings.append(
                f"{grant['tool']} may run unattended, which the task did not require"
            )

    # The run id inside the token makes every downstream log answer which run caused what.
    if run["credential"] == "standing":
        findings.append(
            "the run uses a standing credential rather than a run-scoped one"
        )

    decisions = []
    spent = 0

    for index, call in enumerate(run["calls"]):
        grant = by_tool.get(call["tool"])

        def refuse(reason):
            decisions.append(
                {"call": index, "tool": call["tool"], "allowed": False, "reason": reason}
            )

        if grant is None:
            refuse("no grant for this tool")
            continue
        if grant["appearedAfterAudit"]:
            refuse("appeared after the audit")
            continue
        # Bind every write to entities already in scope, from your records not the arguments.
        if call["entity"] not in run["entitiesInScope"]:
            refuse(f"{call['entity']} is not in scope for this run")
            continue
        if grant["maxPerCall"] is not None and call["amountCents"] > grant["maxPerCall"]:
            refuse(
                f"{call['amountCents']} exceeds the per-call cap of {grant['maxPerCall']}"
            )
            continue
        if (
            grant["maxPerRun"] is not None
            and spent + call["amountCents"] > grant["maxPerRun"]
        ):
            refuse(
                f"{spent + call['amountCents']} exceeds the per-run cap of {grant['maxPerRun']}"
            )
            continue
        spent += call["amountCents"]
        decisions.append(
            {"call": index, "tool": call["tool"], "allowed": True, "reason": None}
        )

    refused = len([d for d in decisions if not d["allowed"]])

    return {
        "status": "findings" if findings else "clean",
        "findings": findings,
        # In shadow mode nothing is actually blocked; you are measuring the policy.
        "decisions": [{**d, "allowed": True} for d in decisions]
        if policy["mode"] == "shadow"
        else decisions,
        "blocked": 0 if policy["mode"] == "shadow" else refused,
        # Denials escalate rather than erroring.
        "escalated": refused,
        "spentCents": spent,
    }
