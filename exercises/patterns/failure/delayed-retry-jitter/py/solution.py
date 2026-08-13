import math


def delays(randoms: list, base_ms: int, cap_ms: int) -> list:
    return [
        math.floor(draw * min(base_ms * 2**index, cap_ms))
        for index, draw in enumerate(randoms)
    ]
