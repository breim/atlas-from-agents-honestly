def triage(tickets: list, routes: dict) -> dict:
    # Control flow is yours. The model classified; the table decides where it goes.
    routed = [
        {"id": ticket["id"], "queue": routes[ticket["predicted"]["category"]]}
        for ticket in tickets
    ]

    def count(holds) -> int:
        return sum(1 for ticket in tickets if holds(ticket))

    def right_category(ticket: dict) -> bool:
        return ticket["predicted"]["category"] == ticket["truth"]["category"]

    return {
        "routed": routed,
        "scoreboard": {
            "total": len(tickets),
            "categoryCorrect": count(right_category),
            "entitiesCorrect": count(
                lambda t: t["predicted"]["orderIds"] == t["truth"]["orderIds"]
                and t["predicted"]["partNumbers"] == t["truth"]["partNumbers"]
            ),
            # Labelling it wrong is not the same as sending it to the wrong place.
            "routedCorrectly": count(
                lambda t: routes[t["predicted"]["category"]]
                == routes[t["truth"]["category"]]
            ),
            # A self-report, scored against reality and used for nothing else.
            "selfReportAgreed": count(
                lambda t: t["predicted"]["answerable"] == t["truth"]["answerable"]
            ),
            # The ceiling: one call resolves a ticket only if the ticket was answerable
            # from its own text and the category was right.
            "resolved": count(lambda t: t["truth"]["answerable"] and right_category(t)),
        },
    }
