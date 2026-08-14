def admit(candidate: dict, pinned: dict, trusted: list) -> dict:
    # Unattributed is untrusted, so an empty source list fails this check by design.
    sources = candidate["sources"]
    attributed = bool(sources) and all(source in trusted for source in sources)
    if not attributed:
        return {"admitted": False, "reason": "untrusted_source"}

    pin = pinned.get(candidate["key"])
    if pin is not None and pin != candidate["value"]:
        return {"admitted": False, "reason": "contradicts_pinned"}

    return {"admitted": True, "reason": None}
