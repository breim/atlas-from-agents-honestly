import math


def replay(requests: list, min_cache_tokens: int, ttl_ms: int) -> dict:
    hits: list = []
    misses: list = []
    entry = None

    for index, request in enumerate(requests):
        if request["prefixTokens"] < min_cache_tokens:
            misses.append(index)
            continue

        live = (
            entry is not None
            and entry["prefix"] == request["prefix"]
            and request["at"] - entry["lastUsed"] < ttl_ms
        )
        (hits if live else misses).append(index)
        entry = {"prefix": request["prefix"], "lastUsed": request["at"]}

    rate = 0 if not requests else math.floor(len(hits) * 10000 / len(requests) + 0.5)

    return {"hits": hits, "misses": misses, "hitRateBps": rate}
