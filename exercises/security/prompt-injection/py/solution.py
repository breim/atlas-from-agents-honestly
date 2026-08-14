def assess(path: dict, catalogue: dict, config: dict) -> dict:
    call = path["call"]
    tool = catalogue[call["tool"]]

    # Assigned by where the bytes came from. There is no detection step to evade.
    sources = [r["source"] for r in path["reads"] if r["trust"] == "untrusted"]
    tainted = bool(sources)

    trifecta = {
        "privateData": any(r["private"] for r in path["reads"]),
        "untrustedContent": tainted,
        "exfiltration": tool["exfiltrates"],
    }
    # Reported, never enforced. A path can hold all three and still be safe.
    lethal = all(trifecta.values())

    shared = {
        "tainted": tainted,
        "sources": sources,
        "trifecta": trifecta,
        "lethal": lethal,
    }

    def deny(reason: str) -> dict:
        return {**shared, "admitted": False, "reason": reason, "escalate": True}

    # A control rather than a response to taint: the address comes from the record.
    if tool["exfiltrates"] and call["recipient"] != path["ticket"]["customerEmail"]:
        return deny("recipient_not_from_record")

    if not tainted or tool["class"] <= config["maxClassWhenTainted"]:
        return {**shared, "admitted": True, "reason": None, "escalate": False}

    # Above the ceiling a tainted run needs a narrow, argument-constrained call.
    scoped = (
        call["orderId"] == path["ticket"]["orderId"]
        and call["amountCents"] <= config["tier0CapCents"]
    )
    if scoped:
        return {**shared, "admitted": True, "reason": None, "escalate": False}

    return deny("class_above_taint_ceiling")
