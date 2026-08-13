def _by(stage: str):
    return lambda candidate: (-candidate[stage], candidate["id"])


def rerank(candidates: list, shortlist: int, top_k: int) -> list:
    survivors = sorted(candidates, key=_by("cheap"))[:shortlist]
    return [candidate["id"] for candidate in sorted(survivors, key=_by("precise"))[:top_k]]
