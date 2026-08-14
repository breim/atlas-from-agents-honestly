def harden(suite: dict, policy: dict) -> dict:
    errors = []
    dataset = suite["dataset"]

    # Four sources, and the promoted-failure bucket grows at the rate the system breaks.
    for source in policy["requiredSources"]:
        if not dataset.get(source):
            errors.append(f"the dataset has no {source} cases")

    gated = []
    reported = []
    flake_spend = 0

    for criterion in suite["criteria"]:
        if not criterion["gated"]:
            reported.append(criterion["name"])
            continue
        if criterion["kind"] == "invariant":
            # An invariant gates with no threshold.
            if criterion["threshold"] is not None:
                errors.append(
                    f"{criterion['name']} is an invariant and carries a threshold"
                )
            gated.append(criterion["name"])
            continue
        # A rate gated as an invariant becomes something people re-run until it passes.
        errors.append(
            f"{criterion['name']} is a rate and is gated; report it as a distribution instead"
        )

    for criterion in suite["criteria"]:
        if criterion["kind"] == "rate" and criterion["gated"]:
            flake_spend += policy["rateFalseAlarmBps"]
    if flake_spend > policy["flakeBudgetBps"]:
        errors.append(
            f"gated rates spend {flake_spend} bps against a budget of "
            f"{policy['flakeBudgetBps']}"
        )

    # Four trace fields are demanded by three chapters each; the redundancy is the signal.
    for field in policy["requiredTraceFields"]:
        if field not in suite["traceFields"]:
            errors.append(f"the trace does not carry {field}")

    for injection in policy["requiredInjections"]:
        if injection not in suite["injections"]:
            errors.append(f"no injection covers {injection}")

    # Run the security review against the built system, not the design.
    if suite["reviewedAgainst"] != "built-system":
        errors.append(
            "the security review ran against the design rather than the built system"
        )

    return {
        "status": "soft" if errors else "hardened",
        "errors": errors,
        "gated": gated,
        "reported": reported,
        "flakeSpendBps": flake_spend,
        "datasetSize": sum(dataset.values()),
    }
