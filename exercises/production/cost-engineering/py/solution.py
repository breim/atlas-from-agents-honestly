from math import floor


def run(plan: dict, budget: dict, prices: dict) -> dict:
    prefix = plan["systemTokens"] + plan["toolsTokens"]
    soft = floor(budget["capMicros"] * budget["softRatioBps"] / 10000)

    turns = []
    spent_micros = 0
    input_micros = 0
    output_micros = 0

    for index in range(1, plan["maxTurns"] + 1):
        # The whole transcript is re-sent, unless compaction caps what carries forward.
        grown = prefix + (index - 1) * plan["perTurnTokens"]
        context_tokens = (
            min(grown, plan["compactionCap"]) if plan["compactionCap"] > 0 else grown
        )

        # Degrade before failing: cheaper rates buy turns a hard stop would refuse.
        degrading = spent_micros > soft
        input_rate = (
            prices["degradedInputMicrosPerToken"]
            if degrading
            else prices["inputMicrosPerToken"]
        )
        output_rate = (
            prices["degradedOutputMicrosPerToken"]
            if degrading
            else prices["outputMicrosPerToken"]
        )

        turn_input = context_tokens * input_rate
        turn_output = plan["outputTokens"] * output_rate
        cost_micros = turn_input + turn_output

        # A turn that does not fit is not taken, and is not billed.
        if spent_micros + cost_micros > budget["capMicros"]:
            return {
                "turns": turns,
                "spentMicros": spent_micros,
                "inputMicros": input_micros,
                "outputMicros": output_micros,
                "outcome": "stopped",
            }

        spent_micros += cost_micros
        input_micros += turn_input
        output_micros += turn_output
        turns.append(
            {
                "index": index,
                "contextTokens": context_tokens,
                "costMicros": cost_micros,
                "action": "degrade" if degrading else "proceed",
            }
        )

    return {
        "turns": turns,
        "spentMicros": spent_micros,
        "inputMicros": input_micros,
        "outputMicros": output_micros,
        "outcome": "completed",
    }
