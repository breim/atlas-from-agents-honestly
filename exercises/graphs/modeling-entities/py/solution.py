def validate(graph: dict, ontology: dict) -> dict:
    errors: list = []
    type_of: dict = {}

    for node in graph["nodes"]:
        if node["type"] not in ontology["nodeTypes"]:
            errors.append(f"unknown_node_type:{node['id']}")
        if node["id"] in type_of:
            errors.append(f"duplicate_node:{node['id']}")
        else:
            type_of[node["id"]] = node["type"]

    for edge in graph["edges"]:
        declared = next(
            (e for e in ontology["edgeTypes"] if e["name"] == edge["type"]), None
        )
        if declared is None:
            errors.append(f"unknown_edge_type:{edge['type']}")
            continue

        missing = next((i for i in (edge["from"], edge["to"]) if i not in type_of), None)
        if missing is not None:
            errors.append(f"missing_node:{missing}")
            continue

        if type_of[edge["from"]] != declared["from"]:
            errors.append(f"domain_mismatch:{edge['type']}")
        elif type_of[edge["to"]] != declared["to"]:
            errors.append(f"range_mismatch:{edge['type']}")

    return {"valid": not errors, "errors": errors}
