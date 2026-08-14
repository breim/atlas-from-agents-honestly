def search(query: list, docs: list, idf: dict, top_k: int) -> list:
    terms = list(dict.fromkeys(query))

    hits = []
    for doc in docs:
        score = sum(doc["terms"].count(term) * idf.get(term, 0) for term in terms)
        if score > 0:
            hits.append({"id": doc["id"], "score": score})

    hits.sort(key=lambda hit: (-hit["score"], hit["id"]))
    return hits[:top_k]
