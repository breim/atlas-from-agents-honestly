USAGE = ("gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens")


def collect(spans: list, config: dict, provider_tokens: int) -> dict:
    # Exactly one owner per span type. Anyone else wrapping the same call is a second copy.
    kept = [s for s in spans if s["emitter"] == config["owners"].get(s["type"])]
    dropped = [s for s in spans if s["emitter"] != config["owners"].get(s["type"])]

    redacted = []
    violations = []

    for span in kept:
        keys = sorted(span["attributes"])

        if not config["captureContent"] and any(k in config["contentKeys"] for k in keys):
            redacted.append(span["id"])

        for key in keys:
            if key.startswith("gen_ai."):
                if key not in config["conventionKeys"]:
                    violations.append(f"{span['id']}:unknown_convention_key:{key}")
            elif not key.startswith(config["namespace"] + "."):
                violations.append(f"{span['id']}:unnamespaced_key:{key}")

    tokens = sum(span["attributes"].get(key, 0) for span in kept for key in USAGE)

    return {
        "kept": [span["id"] for span in kept],
        "dropped": [span["id"] for span in dropped],
        "redacted": redacted,
        "violations": violations,
        "tokens": tokens,
        "tokensMatchProvider": tokens == provider_tokens,
    }
