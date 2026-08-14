from math import floor


def _loop(prefix: int, turns: int, per_turn: int) -> int:
    # The transcript is re-sent every turn, so each agent runs its own quadratic.
    return turns * prefix + per_turn * (turns * (turns - 1) // 2)


def price(topology: dict, baseline: dict, config: dict) -> dict:
    per_agent = [
        {
            "name": agent["name"],
            # The inbound summary joins the prefix, so it is re-read on every turn.
            "inputTokens": _loop(
                agent["prefixTokens"] + agent["inboundSummaryTokens"],
                agent["turns"],
                agent["outputPerTurn"],
            ),
            # The outbound summary is written once.
            "outputTokens": agent["turns"] * agent["outputPerTurn"]
            + agent["outboundSummaryTokens"],
        }
        for agent in topology["agents"]
    ]

    input_tokens = sum(a["inputTokens"] for a in per_agent)
    output_tokens = sum(a["outputTokens"] for a in per_agent)
    total_tokens = input_tokens + output_tokens

    baseline_tokens = _loop(
        baseline["prefixTokens"], baseline["turns"], baseline["outputPerTurn"]
    ) + baseline["turns"] * baseline["outputPerTurn"]

    spans = [
        config["rampUpMs"] + agent["turns"] * config["turnMs"]
        for agent in topology["agents"]
    ]
    # The one refund: independent work finishes in the time of the slowest.
    if not spans:
        latency_ms = 0
    elif topology["parallel"]:
        latency_ms = max(spans)
    else:
        latency_ms = sum(spans)

    cost_micros = (
        input_tokens * config["inputMicrosPerToken"]
        + output_tokens * config["outputMicrosPerToken"]
    )

    # A single agent has no coordination tax to justify.
    reasons = []
    if len(topology["agents"]) > 1:
        if topology["taskValueMicros"] < cost_micros:
            reasons.append("value_below_cost")
        if not topology["parallel"] and not topology["isolationRequired"]:
            reasons.append("not_parallel_and_no_isolation")

    return {
        "perAgent": per_agent,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "totalTokens": total_tokens,
        "costMicros": cost_micros,
        "baselineTokens": baseline_tokens,
        "multiplierBps": 0
        if baseline_tokens == 0
        else floor(total_tokens * 10000 / baseline_tokens + 0.5),
        "latencyMs": latency_ms,
        "worthIt": not reasons,
        "reasons": reasons,
    }
