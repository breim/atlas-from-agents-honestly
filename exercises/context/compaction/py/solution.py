def _at(turns: list, dropped: int, cost_per_fact: int) -> dict:
    """Dropping more turns frees their tokens but adds summary cost, so every prefix is tried."""
    kept = turns[dropped:]
    summarised = list(
        dict.fromkeys(fact for turn in turns[:dropped] for fact in turn["facts"])
    )
    tokens = sum(turn["tokens"] for turn in kept) + len(summarised) * cost_per_fact

    return {
        "kept": [turn["id"] for turn in kept],
        "summarised": summarised,
        "tokens": tokens,
        "fits": True,
    }


def compact(turns: list, budget: int, cost_per_fact: int) -> dict:
    for dropped in range(len(turns) + 1):
        candidate = _at(turns, dropped, cost_per_fact)
        if candidate["tokens"] <= budget:
            return candidate

    return {**_at(turns, len(turns), cost_per_fact), "fits": False}
