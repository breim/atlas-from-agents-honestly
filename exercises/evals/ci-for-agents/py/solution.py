def audit(suite: dict, policy: dict, question: str) -> dict:
    errors = []

    # One configuration for both questions makes a suite flaky and blind at once.
    if question == "did-it-change" and suite["configuration"] != "tightest":
        errors.append("did-it-change needs the tightest configuration the model accepts")
    if question == "how-good-is-it":
        if suite["configuration"] != "production":
            errors.append(
                "a quality claim measured off production settings is about a system "
                "nobody runs"
            )
        if suite["seeds"] < 2:
            errors.append("a quality claim from one seed has no variance to report")

    # Declared in advance is a design; chosen after seeing red is p-hacking.
    if suite["rerunPolicy"] == "undeclared":
        errors.append("the re-run policy is not declared in advance")

    # Decide the regression size that matters, then derive the set size.
    sizes = sorted(
        ({"points": int(k), "needed": v} for k, v in policy["detectableAt"].items()),
        key=lambda entry: entry["points"],
    )
    reachable = next(
        (e for e in sizes if suite["casesPerArm"] >= e["needed"]), None
    )
    detectable_points = reachable["points"] if reachable else None

    gated = []
    reported = []

    for criterion in suite["criteria"]:
        if not criterion["gated"]:
            reported.append(criterion["name"])
            continue
        # A deterministic assertion has no sampling error, so it gates at any set size.
        if criterion["kind"] == "deterministic":
            gated.append(criterion["name"])
            continue
        if (
            detectable_points is None
            or criterion["observedDropPoints"] < detectable_points
        ):
            errors.append(
                f"{criterion['name']} gates on {criterion['observedDropPoints']} points, "
                f"below what {suite['casesPerArm']} cases can detect"
            )
            continue
        gated.append(criterion["name"])

    # Sixty binary criteria gated individually produce false alarms by construction.
    judged_gates = len(
        [c for c in suite["criteria"] if c["gated"] and c["kind"] == "judged"]
    )
    expected = judged_gates * policy["falseAlarmBps"]
    if expected > policy["flakeBudgetBps"]:
        errors.append(
            f"gating {judged_gates} judged criteria individually spends {expected} bps "
            f"against a budget of {policy['flakeBudgetBps']}"
        )

    return {
        "status": "unsound" if errors else "sound",
        "errors": errors,
        "detectablePoints": detectable_points,
        "gated": gated,
        "reported": reported,
        "expectedFalseAlarmsBps": expected,
    }
