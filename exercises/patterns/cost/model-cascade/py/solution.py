def cascade(ladder: list, confidences: list, threshold: float) -> dict:
    tried: list = []
    spent = 0

    for index, rung in enumerate(ladder):
        tried.append(rung["model"])
        spent += rung["cost"]

        last = index == len(ladder) - 1
        if confidences[index] >= threshold or last:
            return {
                "answeredBy": rung["model"],
                "tried": tried,
                "spent": spent,
                "escalated": len(tried) > 1,
            }

    raise ValueError("an empty ladder cannot answer")
