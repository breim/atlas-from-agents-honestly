TERMINAL = ("completed", "failed", "escalated")


def check(run: dict, caps: dict) -> dict:
    boundaries = run["boundaries"]
    trace = run["trace"]

    # Six promises, always the same six, so a violation names which one broke.
    # Nothing here reads answerCorrect: the semantic class has no signal to assert on.
    invariants = [
        ("terminal", run["terminalState"] in TERMINAL),
        ("no_duplicate", all(effect["count"] <= 1 for effect in run["effects"])),
        (
            "bounded",
            run["costCents"] <= caps["costCents"] and run["turns"] <= caps["turns"],
        ),
        (
            "escalated",
            not run["unresolved"]
            or (
                run["terminalState"] == "escalated"
                and run["escalationReason"] is not None
            ),
        ),
        (
            "traceable",
            trace["injectedFault"] is not None and trace["recoveryRecorded"],
        ),
        (
            "contained",
            boundaries["tenantPropagated"]
            and boundaries["taintHeld"]
            and boundaries["authorized"],
        ),
    ]

    violations = [name for name, held in invariants if not held]

    return {
        "violations": violations,
        "held": [name for name, held in invariants if held],
        "passed": not violations,
    }
