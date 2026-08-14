def resolve(records: list, pairs: list, threshold: int) -> list:
    # A cluster is a connected component, so transitivity comes with the union.
    parent = {record: record for record in records}

    def find(record: str) -> str:
        while parent[record] != record:
            record = parent[record]
        return record

    for pair in pairs:
        if pair["score"] < threshold:
            continue
        parent[find(pair["a"])] = find(pair["b"])

    clusters: dict = {}
    for record in records:
        clusters.setdefault(find(record), []).append(record)

    return sorted((sorted(cluster) for cluster in clusters.values()), key=lambda c: c[0])
