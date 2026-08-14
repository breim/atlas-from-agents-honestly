ANSWERS = ("approve", "deny", "edit", "escalate")


def gate(spec: dict, decision: dict, presented_at_ms: int, policy: dict) -> dict:
    errors = []

    # Resume re-executes the node from the top, so a gate holds one side-effecting call.
    if len(spec["sideEffects"]) != 1:
        errors.append(
            f"a gate node holds one side-effecting call, not {len(spec['sideEffects'])}"
        )

    # Hide a material fact and you have added latency without oversight.
    for field in policy["required"]:
        if field not in spec["disclose"]:
            errors.append(f"the reviewer is not shown {field}")

    # Four answers, not two. Edit is the one reviewers actually want.
    for answer in ANSWERS:
        if answer not in spec["answers"]:
            errors.append(f"the gate does not accept {answer}")

    # An approval is a decision about a state, and the state moves.
    if spec["expiresAfterMs"] > policy["volatilityMs"]:
        errors.append(
            f"expiry of {spec['expiresAfterMs']}ms outlives data that moves every "
            f"{policy['volatilityMs']}ms"
        )

    if spec["lane"] == "fast" and spec["position"] == "execution":
        errors.append("an execution gate belongs in the deliberate lane")

    if errors:
        return {
            "status": "invalid",
            "errors": errors,
            "next": "none",
            "applied": None,
            "staleBy": 0,
        }

    age = decision["atMs"] - presented_at_ms
    stale_by = max(0, age - spec["expiresAfterMs"])
    if stale_by > 0:
        # An update, not a signal: staleness is rejected before it is recorded.
        return {
            "status": "rejected",
            "errors": [f"the decision is {stale_by}ms past its validity"],
            "next": "revise",
            "applied": None,
            "staleBy": stale_by,
        }

    if decision["answer"] not in spec["answers"]:
        return {
            "status": "rejected",
            "errors": [f"{decision['answer']} is not an answer this gate accepts"],
            "next": "none",
            "applied": None,
            "staleBy": 0,
        }

    if decision["answer"] == "deny" and not decision.get("reason"):
        return {
            "status": "rejected",
            "errors": ["a denial without a reason is not an instruction"],
            "next": "none",
            "applied": None,
            "staleBy": 0,
        }

    if decision["answer"] == "edit" and not decision.get("edit"):
        return {
            "status": "rejected",
            "errors": ["an edit without a correction is a denial"],
            "next": "none",
            "applied": None,
            "staleBy": 0,
        }

    following = {
        "approve": "act",
        "edit": "act",
        "deny": "revise",
        "escalate": "halt",
    }[decision["answer"]]

    if decision["answer"] == "edit":
        applied = decision["edit"]
    elif decision["answer"] == "approve":
        applied = spec["sideEffects"][0]
    else:
        applied = None

    return {
        "status": "accepted",
        "errors": [],
        # The deny path is a branch, not an end state.
        "next": following,
        "applied": applied,
        "staleBy": 0,
    }
