def _supervise_violations(plan: dict) -> list:
    violations = []
    inputs = [agent["input"] for agent in plan["agents"]]
    if len(set(inputs)) != len(inputs):
        violations.append("overlapping_inputs")
    # A worker talking to a worker is a handoff bought inside a supervisor.
    if any(agent["next"] is not None for agent in plan["agents"]):
        violations.append("workers_talked")
    # A verifier given conclusions is a second vote, not a check.
    if plan["verifiesAgainst"] != "sources":
        violations.append("verified_against_conclusions")
    return violations


def execute(plan: dict, budget: dict) -> dict:
    steps = []

    if plan["topology"] == "supervisor":
        violations = _supervise_violations(plan)
        # Every worker reads a source directly, so nothing is compressed on the way in.
        for agent in plan["agents"]:
            if len(steps) >= budget["maxSteps"]:
                return {
                    "steps": steps,
                    "outcome": "budget_exhausted",
                    "terminatedBy": "budget",
                    "violations": violations,
                }
            steps.append({"agent": agent["name"], "compressionDepth": 1})

        if len(steps) >= budget["maxSteps"]:
            return {
                "steps": steps,
                "outcome": "budget_exhausted",
                "terminatedBy": "budget",
                "violations": violations,
            }

        steps.append(
            {
                "agent": "synthesize",
                "compressionDepth": 1 if plan["verifiesAgainst"] == "sources" else 2,
            }
        )
        return {
            "steps": steps,
            "outcome": "completed",
            "terminatedBy": "supervisor",
            "violations": violations,
        }

    by_name = {agent["name"]: agent for agent in plan["agents"]}
    # Nobody owns termination unless somebody declares it.
    violations = (
        [] if any(a["declaresDone"] for a in plan["agents"]) else ["no_termination_owner"]
    )

    current = plan["start"]
    while len(steps) < budget["maxSteps"]:
        agent = by_name[current]
        # Each transfer is another compression of what the previous agent kept.
        steps.append({"agent": agent["name"], "compressionDepth": len(steps) + 1})
        if agent["declaresDone"]:
            return {
                "steps": steps,
                "outcome": "completed",
                "terminatedBy": agent["name"],
                "violations": violations,
            }
        # Nowhere to hand it and nobody claiming it: the seam where a ticket is dropped.
        if agent["next"] is None:
            return {
                "steps": steps,
                "outcome": "dropped",
                "terminatedBy": "nobody",
                "violations": violations,
            }
        current = agent["next"]

    return {
        "steps": steps,
        "outcome": "budget_exhausted",
        "terminatedBy": "budget",
        "violations": violations,
    }
