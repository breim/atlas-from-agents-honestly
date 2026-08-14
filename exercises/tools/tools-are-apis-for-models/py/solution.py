def surface(endpoints: list, design: list, policy: dict) -> dict:
    by_id = {endpoint["id"]: endpoint for endpoint in endpoints}

    tools = []
    rejected = []
    warnings = []

    for proposed in design:
        # Arguments come from the model; authority does not, so it is never in the schema.
        identity = next(
            (arg for arg in proposed["args"] if arg in policy["identityFields"]), None
        )
        if identity:
            rejected.append(
                {
                    "name": proposed["name"],
                    "reason": f"{identity} is authority, not an argument the model may choose",
                }
            )
            continue

        # The description is shipped, and it is the routing logic.
        words = len(proposed["description"].split())
        if words < policy["minDescriptionWords"]:
            rejected.append(
                {
                    "name": proposed["name"],
                    "reason": f"the description is the interface, and this one is {words} words",
                }
            )
            continue

        missing_endpoint = next((i for i in proposed["job"] if i not in by_id), None)
        if missing_endpoint:
            rejected.append(
                {
                    "name": proposed["name"],
                    "reason": f"names an endpoint that does not exist: {missing_endpoint}",
                }
            )
            continue

        available = {}
        for endpoint_id in proposed["job"]:
            available.update(by_id[endpoint_id]["fields"])

        unavailable = next(
            (f for f in proposed["returns"] if f not in available), None
        )
        if unavailable:
            rejected.append(
                {
                    "name": proposed["name"],
                    "reason": f"returns {unavailable}, which no endpoint in its job produces",
                }
            )
            continue

        if not proposed.get("notFor"):
            warnings.append(
                f"{proposed['name']} states no boundary, so the model must guess "
                "when not to call it"
            )

        tools.append(
            {
                "name": proposed["name"],
                "arguments": proposed["args"],
                "returns": proposed["returns"],
                # A chain in a fixed order is one call, whatever it costs you behind the tool.
                "roundTrips": 1,
                "endpoints": len(proposed["job"]),
                "tokens": sum(available[f] for f in proposed["returns"]),
            }
        )

    if len(tools) > policy["maxLiveTools"]:
        warnings.append(
            f"a surface of {len(tools)} tools exceeds the live budget of "
            f"{policy['maxLiveTools']}"
        )

    everything = sum(
        sum(endpoint["fields"].values()) for endpoint in endpoints
    )

    return {
        "tools": tools,
        "rejected": rejected,
        "warnings": warnings,
        "generated": {
            "toolCount": len(endpoints),
            "roundTrips": len(endpoints),
            "tokens": everything,
        },
        "curated": {
            "toolCount": len(tools),
            "roundTrips": sum(t["roundTrips"] for t in tools),
            "tokens": sum(t["tokens"] for t in tools),
        },
    }
