import math

RATES = ("input", "output", "cacheWrite", "cacheRead")


def cost_micros(usage: dict, pricing: dict) -> int:
    total = sum(usage[rate] * pricing[rate] for rate in RATES)
    return math.floor(total + 0.5)
