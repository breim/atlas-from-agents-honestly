def rewrite(query: str, synonyms: dict) -> str:
    terms = query.split()
    expanded = dict.fromkeys(terms)

    for term in terms:
        for synonym in synonyms.get(term, []):
            expanded.setdefault(synonym)

    return " ".join(expanded)
