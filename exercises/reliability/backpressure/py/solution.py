from math import floor


def admit(run: dict, used: dict, config: dict) -> dict:
    # Sized below the provider's, so load is shed deliberately and a 429 is an alert.
    effective = floor(config["inputTpm"] * config["clientLimitBps"] / 10000)
    priority = run["priority"]
    class_budget = floor(effective * config["shareBps"][priority] / 10000)
    tenant_cap = floor(effective * config["tenantCapBps"] / 10000)

    profile = config["profile"]
    per_minute = profile["avgContextTokens"] * profile["turnsPerMinute"]
    concurrent = 0 if per_minute == 0 else floor(effective / per_minute)

    # Retries were generated inside runs already admitted. They bypass the door unless
    # they are counted here.
    spent = used["byPriority"][priority] + used["retriesByPriority"][priority]

    shared = {
        "classBudget": class_budget,
        "tenantCap": tenant_cap,
        "headroom": class_budget - spent,
        "effectiveConcurrentRuns": concurrent,
    }

    if spent + run["estInputTokens"] > class_budget:
        return {
            "admitted": False,
            "reason": "class_budget",
            "retryAfterMs": config["backoffMs"][priority],
            **shared,
        }

    tenant = used["byTenant"].get(run["tenantId"], 0)
    if tenant + run["estInputTokens"] > tenant_cap:
        return {
            "admitted": False,
            "reason": "tenant_cap",
            "retryAfterMs": config["tenantBackoffMs"],
            **shared,
        }

    return {"admitted": True, "reason": None, "retryAfterMs": 0, **shared}
