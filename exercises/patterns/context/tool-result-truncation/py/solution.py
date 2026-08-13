import math


def truncate(text: str, budget: int, marker: str) -> str:
    if len(text) <= budget:
        return text

    room = budget - len(marker)
    if room <= 0:
        return marker[:budget]

    head = math.ceil(room / 2)
    tail = room - head
    return text[:head] + marker + (text[-tail:] if tail > 0 else "")
