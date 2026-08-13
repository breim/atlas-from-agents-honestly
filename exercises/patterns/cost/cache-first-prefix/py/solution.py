import math


def price(previous: list, current: list, pricing: dict) -> dict:
    shared = 0
    while (
        shared < len(current)
        and shared < len(previous)
        and previous[shared] == current[shared]
    ):
        shared += 1

    cached = sum(block["tokens"] for block in current[:shared])
    fresh = sum(block["tokens"] for block in current[shared:])

    return {
        "cached": cached,
        "fresh": fresh,
        "micros": math.floor(
            cached * pricing["cacheRead"] + fresh * pricing["cacheWrite"] + 0.5
        ),
    }
