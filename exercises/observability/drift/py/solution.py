def diagnose(window: dict, thresholds: dict) -> dict:
    signals = [
        ("deploy", window["deployed"]),
        ("canary", window["canaryScoreDeltaBps"] <= -thresholds["canaryDropBps"]),
        (
            "chunk_turnover",
            window["citedChunkTurnoverBps"] >= thresholds["chunkTurnoverBps"],
        ),
        (
            "input_centroid",
            window["inputCentroidShiftBps"] >= thresholds["centroidShiftBps"],
        ),
        ("eval_score", window["evalScoreDeltaBps"] <= -thresholds["evalDropBps"]),
        (
            "format_compliance",
            window["formatComplianceDeltaBps"] <= -thresholds["formatDropBps"],
        ),
    ]
    tripped = [name for name, fired in signals if fired]

    # The deploy log first, because it is the most common answer and the last one checked.
    if "deploy" in tripped:
        cause = "check_the_deploy_log"
    # Frozen inputs and a pinned config leave only the provider.
    elif "canary" in tripped:
        cause = "provider_behavior_changed"
    elif "chunk_turnover" in tripped:
        cause = "corpus_moved"
    # Either half alone has a base rate too high to page on. The conjunction does not.
    elif "input_centroid" in tripped and "eval_score" in tripped:
        cause = "input_distribution_changed"
    elif "format_compliance" in tripped:
        cause = "output_shape_changed"
    else:
        cause = None

    return {"cause": cause, "tripped": tripped}
