def _merge(group: list) -> str:
    """A lone item carries to the next level rather than joining a full group."""
    return group[0] if len(group) == 1 else f"({'+'.join(group)})"


def reduce_tree(items: list, fan_in: int) -> dict:
    levels: list = []
    current = items

    while len(current) > 1:
        nxt = [
            _merge(current[start : start + fan_in]) for start in range(0, len(current), fan_in)
        ]
        levels.append(nxt)
        current = nxt

    return {"result": current[0] if current else None, "levels": levels}
