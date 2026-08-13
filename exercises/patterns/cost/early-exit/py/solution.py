def run(stages: list, execute) -> dict:
    ran: list = []
    spent = 0

    for index, stage in enumerate(stages):
        ran.append(stage["name"])
        spent += stage["cost"]

        last = index == len(stages) - 1
        if execute(stage["name"]) == "settled" or last:
            return {"settledBy": stage["name"], "ran": ran, "spent": spent}

    raise ValueError("an empty pipeline cannot settle anything")
