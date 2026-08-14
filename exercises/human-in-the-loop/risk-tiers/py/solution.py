POSTURE = {
    #                 small       moderate    large
    "reversible": ["auto", "notify", "approve"],
    "costly": ["notify", "approve", "dual"],
    "irreversible": ["approve", "dual", "dual"],
}

DECISIONS = {"auto": 0, "notify": 0, "approve": 1, "dual": 2}


def assess(calls: list, catalogue: dict, capacity: int) -> dict:
    decisions = []
    for call in calls:
        tool = catalogue[call["tool"]]

        # Reversibility is a property of the action. The same tool sending an approved
        # template and sending model-authored prose are two different risks.
        reversibility = tool["reversibility"]
        if call["templated"] and "templatedReversibility" in tool:
            reversibility = tool["templatedReversibility"]

        reached = [edge for edge in tool["radiusThresholds"] if call["scope"] >= edge]
        radius = min(len(reached), 2)

        decisions.append(
            {"tool": call["tool"], "posture": POSTURE[reversibility][radius]}
        )

    approvals = sum(
        DECISIONS[decision["posture"]] * call["count"]
        for decision, call in zip(decisions, calls)
    )

    return {
        "decisions": decisions,
        "approvals": approvals,
        "affordable": approvals <= capacity,
    }
