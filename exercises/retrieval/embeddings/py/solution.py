import math


def _norm(v: list) -> float:
    return math.sqrt(sum(x * x for x in v))


def nearest(query: list, vectors: list, top_k: int) -> list:
    query_norm = _norm(query)
    if query_norm == 0:
        return []

    hits = []
    for vector in vectors:
        vector_norm = _norm(vector["v"])
        if vector_norm == 0:
            continue
        dot = sum(x * q for x, q in zip(vector["v"], query))
        bps = math.floor(dot / (vector_norm * query_norm) * 10000 + 0.5)
        hits.append({"id": vector["id"], "bps": bps})

    hits.sort(key=lambda hit: (-hit["bps"], hit["id"]))
    return hits[:top_k]
