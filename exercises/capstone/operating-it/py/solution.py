def operate(rollout: dict, signals: list, incident: dict, drift: dict, ledger: dict, policy: dict) -> dict:
    errors = []
    warnings = []

    # A good rollout is anticlimactic: one number in a manifest, reversible in seconds.
    if len(rollout["changedFields"]) > policy["maxChangedFields"]:
        errors.append(
            f"{len(rollout['changedFields'])} fields changed; a rollout is one number "
            "in a manifest"
        )
    # Retaining the previous build turns an eleven-minute fix into an available option.
    reversible = rollout["previousIndexRetained"] and len(rollout["changedFields"]) <= policy["maxChangedFields"]
    if not rollout["previousIndexRetained"]:
        errors.append(
            "the previous index build was not retained, so there is nothing to roll back to"
        )

    # Week one of a canary is for reading outputs, not dashboards.
    if rollout["canaryDays"] < policy["minCanaryDays"]:
        errors.append(f"a {rollout['canaryDays']}-day canary is too short to read")
    if rollout["canaryReviewedBy"] != "reading-outputs":
        errors.append(
            "the canary was reviewed on dashboards rather than by reading outputs"
        )

    # The metric that surprises you first is usually the one whose definition was wrong.
    for signal in signals:
        if signal["moved"] and signal["kind"] == "definition":
            warnings.append(
                f"{signal['name']} moved because its definition was wrong, not its "
                "implementation"
            )

    # A well-handled incident is unremarkable, and every step has to be there.
    for step in policy["incidentSteps"]:
        if not incident.get(step):
            errors.append(f"the incident response never {step}")
    # Inject the human consequence, not just the technical fault.
    if not incident["humanConsequenceInjected"]:
        errors.append(
            "the drill injected the technical fault and not the human consequence"
        )

    # Drift diagnosis is four queries, and nine minutes when each is already instrumented.
    missing = [q for q in policy["driftQueries"] if q not in drift["queriesRun"]]
    for query in missing:
        errors.append(f"drift diagnosis has no {query} query")
    drift_minutes = len(policy["driftQueries"]) * 2 + 1 if not missing else None

    # Report the ledger honestly, including the misses.
    misses = ledger["claimed"] - ledger["hit"]
    ledger_honest = (
        ledger["missesReported"] == misses
        and ledger["structuralMisses"] + ledger["knownCauseMisses"] == misses
    )
    if not ledger_honest:
        errors.append("the ledger does not report every miss, separated by cause")

    return {
        "status": "not-operable" if errors else "operable",
        "errors": errors,
        "warnings": warnings,
        "reversibleInSeconds": reversible,
        "driftMinutes": drift_minutes,
        "ledgerHonest": ledger_honest,
    }
