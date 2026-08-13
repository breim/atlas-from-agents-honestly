def _allowed(chunk: dict, filter_: dict) -> bool:
    return chunk["tenantId"] == filter_["tenantId"] and all(
        tag in chunk["tags"] for tag in filter_["requireTags"]
    )


def search(chunks: list, filter_: dict, top_k: int) -> list:
    survivors = [chunk for chunk in chunks if _allowed(chunk, filter_)]
    ranked = sorted(survivors, key=lambda chunk: (-chunk["score"], chunk["id"]))
    return [chunk["id"] for chunk in ranked[:top_k]]
