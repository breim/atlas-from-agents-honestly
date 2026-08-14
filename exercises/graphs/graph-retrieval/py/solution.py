def traverse(start: str, nodes: list, edges: list, max_hops: int, tenant_id: str) -> list:
    visible = {node["id"] for node in nodes if node["tenantId"] == tenant_id}
    if start not in visible:
        return []

    visited = [start]
    seen = {start}
    frontier = [start]

    for _ in range(max_hops):
        nxt: list = []
        for edge in edges:
            # The predicate gates the walk, so nothing beyond a foreign node is reachable.
            if edge["from"] not in frontier or edge["to"] in seen or edge["to"] not in visible:
                continue
            seen.add(edge["to"])
            visited.append(edge["to"])
            nxt.append(edge["to"])
        if not nxt:
            break
        frontier = nxt

    return visited
