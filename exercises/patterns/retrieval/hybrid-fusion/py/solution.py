def fuse(rankings: list, k: int) -> list:
    scores: dict = {}

    for ranking in rankings:
        for index, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1 / (k + index + 1)

    return [doc_id for doc_id, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0]))]
