def classify(signals: dict) -> str:
    # Structure decides the shape; judgement only decides whether a model appears inside it.
    if not signals["stepsKnownUpfront"] or not signals["branchesEnumerable"]:
        return "agent"

    return "workflow-with-model-steps" if signals["needsJudgement"] else "workflow"
