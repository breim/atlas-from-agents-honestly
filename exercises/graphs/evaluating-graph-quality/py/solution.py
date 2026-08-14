import math


def _key(triple: dict) -> str:
    """All three parts, so a wrong relation or a reversed direction is a different fact."""
    return f"{triple['from']}|{triple['type']}|{triple['to']}"


def _bps(numerator: int, denominator: int) -> int:
    if denominator == 0:
        return 10000
    return math.floor(numerator * 10000 / denominator + 0.5)


def evaluate(extracted: list, gold: list) -> dict:
    truth = {_key(triple) for triple in gold}
    claimed = {_key(triple) for triple in extracted}

    spurious = [triple for triple in extracted if _key(triple) not in truth]
    missed = [triple for triple in gold if _key(triple) not in claimed]

    return {
        "precisionBps": _bps(len(extracted) - len(spurious), len(extracted)),
        "recallBps": _bps(len(gold) - len(missed), len(gold)),
        "spurious": spurious,
        "missed": missed,
    }
