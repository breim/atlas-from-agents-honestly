def _distance_of(chunk: dict, query: dict) -> int:
    return abs(chunk["embedding"] - query["point"])


def _matches(chunk: dict, filters: dict) -> bool:
    # Not optional and not a ranking signal: the current-version rule holds whatever was asked.
    if chunk["supersededAt"] is not None:
        return False
    for field in ("tier", "region", "tenantId"):
        if field in filters and chunk[field] != filters[field]:
            return False
    return True


def _hit_of(chunk: dict, query: dict) -> dict:
    return {
        "id": chunk["id"],
        "documentId": chunk["documentId"],
        "version": chunk["version"],
        "distance": _distance_of(chunk, query),
    }


def search(query: dict, filters: dict, k: int, index: dict) -> dict:
    # Similarity only orders. Ties break on id so the ordering is total.
    ordered = sorted(index["chunks"], key=lambda c: (_distance_of(c, query), c["id"]))
    matching = [chunk for chunk in ordered if _matches(chunk, filters)]

    if index["strategy"] == "post":
        # Search the whole index, then discard. What survives is whatever happened to be near.
        scanned = len(index["chunks"])
        results = [
            _hit_of(chunk, query)
            for chunk in ordered[: index["probe"]]
            if _matches(chunk, filters)
        ][:k]
    else:
        results = [_hit_of(chunk, query) for chunk in matching[:k]]
        # Pre-filtering computes a distance for every member; the graph walk prunes instead.
        scanned = (
            len(matching)
            if index["strategy"] == "pre"
            else min(len(matching), index["probe"])
        )

    return {
        "strategy": index["strategy"],
        "results": results,
        "scanned": scanned,
        "filtered": len(matching),
        "shortfall": k - len(results),
    }
