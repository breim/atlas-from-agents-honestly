def revise(draft: str, rounds: list) -> dict:
    outcome = {"draft": draft, "accepted": [], "rejected": []}

    for round_ in rounds:
        if round_["resolves"] and not round_["introduces"]:
            outcome["draft"] = round_["draft"]
            outcome["accepted"].append(round_["draft"])
        else:
            outcome["rejected"].append(round_["draft"])

    return outcome
