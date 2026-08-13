import math


def analyse(samples: list, consensus_bps: int) -> dict:
    if not samples:
        return {
            "modal": None,
            "modalCount": 0,
            "samples": 0,
            "agreementBps": 0,
            "stable": False,
        }

    counts: dict = {}
    for sample in samples:
        counts[sample] = counts.get(sample, 0) + 1

    # Lexicographic tie-break, so a report about flakiness is not itself flaky.
    modal, modal_count = min(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    agreement = math.floor(modal_count * 10000 / len(samples) + 0.5)

    return {
        "modal": modal,
        "modalCount": modal_count,
        "samples": len(samples),
        "agreementBps": agreement,
        "stable": agreement >= consensus_bps,
    }
