import math


def _recall(run: list, relevant: list, k: int) -> int:
    if not relevant:
        return 10000

    wanted = set(relevant)
    found = sum(1 for doc in run[:k] if doc in wanted)

    return math.floor(found * 10000 / len(relevant) + 0.5)


def compare(runs: dict, relevant: list, k: int) -> dict:
    semantic = _recall(runs["semantic"], relevant, k)
    lexical = _recall(runs["lexical"], relevant, k)
    hybrid = _recall(runs["hybrid"], relevant, k)

    # The bar is the better single retriever, not the one you happened to have first.
    best = max(semantic, lexical)
    if hybrid > best:
        verdict = "gain"
    elif hybrid == best:
        verdict = "no_gain"
    else:
        verdict = "regression"

    return {
        "semanticBps": semantic,
        "lexicalBps": lexical,
        "hybridBps": hybrid,
        "verdict": verdict,
    }
