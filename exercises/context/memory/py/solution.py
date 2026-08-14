def _authority_of(asserted_by: str) -> str:
    return asserted_by.split(":")[0]


def _refuse(write: dict, policy: dict):
    # Memories are replayed verbatim into every future context that loads them.
    if write["predicate"] in policy["secretPredicates"]:
        return "a secret never belongs in a memory store"
    if not write["source"]:
        return "a fact without provenance is not a fact"
    # Conclusions belong to a run, not to the record of what is true about an entity.
    if _authority_of(write["assertedBy"]) == "model":
        return "a model inference is a conclusion, not a fact"
    return None


def remember(request: dict, store: dict, policy: dict, now: int) -> dict:
    admitted = []
    rejected = []

    for write in request["writes"]:
        reason = _refuse(write, policy)
        if reason:
            rejected.append({"id": write["id"], "reason": reason})
        else:
            admitted.append(write["id"])

    facts = store["facts"] + [w for w in request["writes"] if w["id"] in admitted]
    # Append-only is the trap: the retired version is retired explicitly, not merely older.
    retired = {fact["supersedes"] for fact in facts if fact["supersedes"] is not None}

    recalled = []
    for predicate in request["reads"]:
        candidates = [
            fact
            for fact in facts
            if fact["tenantId"] == request["tenantId"]
            and fact["subject"] == request["subject"]
            and fact["predicate"] == predicate
            and fact["id"] not in retired
        ]

        # Highest authority first, then most recent. Never the other way round.
        winner = None
        for fact in candidates:
            if winner is None:
                winner = fact
                continue
            rank = policy["authorityRank"][_authority_of(fact["assertedBy"])]
            best_rank = policy["authorityRank"][_authority_of(winner["assertedBy"])]
            if rank != best_rank:
                winner = fact if rank > best_rank else winner
            elif fact["assertedOnDay"] > winner["assertedOnDay"]:
                winner = fact

        if winner is None:
            recalled.append(
                {
                    "predicate": predicate,
                    "value": None,
                    "source": None,
                    "assertedBy": None,
                    "assertedOnDay": None,
                    "ageDays": None,
                    "stale": False,
                }
            )
            continue

        age_days = now - winner["assertedOnDay"]
        ttl = policy["ttlDays"].get(predicate, policy["defaultTtlDays"])
        recalled.append(
            {
                "predicate": predicate,
                "value": winner["value"],
                "source": winner["source"],
                "assertedBy": winner["assertedBy"],
                "assertedOnDay": winner["assertedOnDay"],
                "ageDays": age_days,
                # Expiry does not delete. It surfaces the fact with its age.
                "stale": age_days > ttl,
            }
        )

    return {"recalled": recalled, "admitted": admitted, "rejected": rejected}
