def inspect(stores: list, run: dict, policy: dict) -> dict:
    by_name = {store["name"]: store for store in stores}
    findings = []

    # Securing the index is the part everyone does. The leak comes from the others.
    uninventoried = [s["name"] for s in stores if not s["inInventory"]]
    for name in uninventoried:
        findings.append(f"{name} is not in the store inventory")

    for store in stores:
        # A forgotten predicate should return empty results, not everything.
        if store["kind"] in policy["requireEngineEnforcement"] and not store["engineEnforced"]:
            findings.append(
                f"{store['name']} leaves the tenant predicate to the application"
            )
        # Derive keys, don't accept them.
        if not store["keyDerived"]:
            findings.append(f"{store['name']} accepts its key from the caller")
        # A pooled connection carrying the previous caller's tenant is load-dependent.
        if store["separation"] == "shared" and not store["scopedToTransaction"]:
            findings.append(f"{store['name']} scopes the tenant outside the transaction")

    # One decision point or none. Three partial systems have the security of the weakest.
    if policy["decisionPoints"] > 1:
        findings.append(
            f"{policy['decisionPoints']} authorization decision points have the "
            "security of the weakest"
        )

    reads = []
    for step in run["steps"]:
        store = by_name.get(step["store"])
        if store is None:
            reads.append({"store": step["store"], "allowed": False, "reason": "no such store"})
            continue
        # Tenancy must survive pauses and resumption on another machine.
        if step["tenantId"] is None:
            reads.append(
                {"store": step["store"], "allowed": False, "reason": "the step carries no tenant"}
            )
            continue
        if step["tenantId"] != run["tenantId"]:
            reads.append(
                {
                    "store": step["store"],
                    "allowed": False,
                    "reason": f"{step['tenantId']} is not the run tenant",
                }
            )
            continue
        if step["onResume"] and run["resumedOnAnotherMachine"] and not store["keyDerived"]:
            reads.append(
                {
                    "store": step["store"],
                    "allowed": False,
                    "reason": "a resumed step re-used a key it did not derive",
                }
            )
            continue
        reads.append({"store": step["store"], "allowed": True, "reason": None})

    leaking = bool(findings) or any(not r["allowed"] for r in reads)

    return {
        "status": "leaking" if leaking else "isolated",
        "findings": findings,
        "reads": reads,
        "uninventoried": uninventoried,
        "layers": {
            "separation": len([s for s in stores if s["separation"] == "per-tenant"]),
            "engine": len([s for s in stores if s["engineEnforced"]]),
            "application": len(stores),
        },
    }
