def apply(signals: list) -> dict:
    entity: dict = {"notes": [], "applied": [], "ignored": []}
    seen: set = set()

    for signal in signals:
        if signal["id"] in seen or signal["kind"] != "note":
            entity["ignored"].append(signal["id"])
            continue

        seen.add(signal["id"])
        entity["applied"].append(signal["id"])
        entity["notes"].append(signal["value"])

    return entity
