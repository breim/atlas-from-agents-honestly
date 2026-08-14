def compile_query(request: dict, layer: dict, rails: dict, principal: dict) -> dict:
    row_limit = min(request.get("limit", rails["maxRowLimit"]), rails["maxRowLimit"])
    applied = {
        "timeoutMs": rails["timeoutMs"],
        # Enforced here, not requested politely inside the query.
        "rowLimit": row_limit,
        "readOnly": rails["readOnly"],
        "tenantId": principal["tenantId"],
    }

    refusals = []

    # Shape two only: the model emits a query object, never a query.
    if "rawSql" in request:
        refusals.append("raw sql is not accepted")

    for name in request.get("filters", {}):
        if name in rails["reservedFilters"]:
            refusals.append(f"{name} is decided by the compiler")

    metric = layer["metrics"].get(request["metric"])
    if metric is None:
        refusals.append(f"unknown metric: {request['metric']}")

    for name in request["dimensions"]:
        if name not in layer["dimensions"]:
            refusals.append(f"unknown dimension: {name}")

    period = layer["periods"].get(request["period"])
    if period is None:
        refusals.append(f"unknown period: {request['period']}")

    # A refusal costs a few minutes. A confident wrong number goes in a quarterly report.
    if refusals:
        return {
            "status": "refused",
            "sql": None,
            "params": [],
            "refusals": refusals,
            "applied": applied,
        }

    selected = ", ".join(
        [
            f"{layer['dimensions'][name]['sql']} AS {name}"
            for name in request["dimensions"]
        ]
        + [f"{metric['sql']} AS {request['metric']}"]
    )

    where = " AND ".join(
        # Appended by the compiler, never written by the model.
        ["tenant_id = $1"]
        + metric["filters"]
        + [f"{metric['timeColumn']} >= $2", f"{metric['timeColumn']} < $3"]
    )

    positions = ", ".join(str(i + 1) for i in range(len(request["dimensions"])))
    grouping = f" GROUP BY {positions} ORDER BY {positions}" if positions else ""

    return {
        "status": "compiled",
        "sql": f"SELECT {selected} FROM {metric['from']} WHERE {where}{grouping} LIMIT {row_limit}",
        "params": [principal["tenantId"], period["from"], period["to"]],
        "refusals": refusals,
        "applied": applied,
    }
