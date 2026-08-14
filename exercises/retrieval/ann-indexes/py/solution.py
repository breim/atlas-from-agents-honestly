import math


def measure(exact: list, approximate: list) -> dict:
    found = set(approximate)
    wanted = set(exact)

    missed = [doc for doc in exact if doc not in found]
    extra = [doc for doc in approximate if doc not in wanted]

    if not exact:
        recall = 10000
    else:
        recall = math.floor((len(exact) - len(missed)) * 10000 / len(exact) + 0.5)

    return {"recallBps": recall, "missed": missed, "extra": extra}
