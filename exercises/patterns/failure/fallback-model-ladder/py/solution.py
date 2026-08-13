INFRASTRUCTURE = ("overloaded", "server_error")


def ask(ladder: list, outcomes: list) -> dict:
    tried: list = []
    spent = 0

    for index, rung in enumerate(ladder):
        tried.append(rung["model"])
        spent += rung["cost"]

        outcome = outcomes[index] if index < len(outcomes) else None
        if outcome == "ok":
            return {"answeredBy": rung["model"], "tried": tried, "spent": spent, "status": "ok"}
        if outcome not in INFRASTRUCTURE:
            return {
                "answeredBy": rung["model"],
                "tried": tried,
                "spent": spent,
                "status": "refused",
            }

    return {"answeredBy": None, "tried": tried, "spent": spent, "status": "exhausted"}
