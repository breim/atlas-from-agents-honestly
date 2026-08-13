import math


def shadow(traffic: list) -> dict:
    served: dict = {}
    divergences: list = []

    for exchange in traffic:
        served[exchange["id"]] = exchange["production"]
        if exchange["candidate"] != exchange["production"]:
            divergences.append(exchange)

    if not traffic:
        agreement = 1
    else:
        agreed = len(traffic) - len(divergences)
        agreement = math.floor(agreed / len(traffic) * 10000 + 0.5) / 10000

    return {"served": served, "divergences": divergences, "agreement": agreement}
