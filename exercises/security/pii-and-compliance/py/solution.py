# Classification lives on the field, assigned at the schema, not guessed from the value.
PERSONAL = ("personal", "restricted")


def _render(field: dict, vault: dict) -> str:
    if field["render"] == "verbatim":
        return field["value"]
    if field["render"] == "pseudonym":
        return vault[field["value"]]
    return "[redacted]"


def assemble(record: list, stores: list, vault: dict) -> dict:
    prompt = [
        {"name": field["name"], "rendered": _render(field, vault)} for field in record
    ]

    personal = [f for f in record if f["sensitivity"] in PERSONAL]
    # Redacting at assembly is what every prompt-fed copy inherits. A raw store inherits
    # nothing, which is why deletion still has to work there.
    in_prompt = [f["name"] for f in personal if f["render"] == "verbatim"]
    everything = [f["name"] for f in personal]

    exposure = [
        {
            "store": store["name"],
            "personalFields": everything if store["receives"] == "raw" else in_prompt,
        }
        for store in stores
    ]

    keyed = {store["name"]: store["keyedBySubject"] for store in stores}

    return {
        "prompt": prompt,
        "exposure": exposure,
        # Personal data with no subject key is personal data you cannot delete on request.
        "unerasable": [
            entry["store"]
            for entry in exposure
            if entry["personalFields"] and not keyed[entry["store"]]
        ],
    }
