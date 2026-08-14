def route(signals: list, table: list, fallback: str) -> str:
    # Table order, not signal order: the same question must always route the same way.
    matched = next((rule for rule in table if rule["signal"] in signals), None)

    return matched["store"] if matched else fallback
