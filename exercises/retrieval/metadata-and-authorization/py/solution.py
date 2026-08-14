def retrieve(query: dict, principal: dict, index: dict, config: dict) -> dict:
    # The principal is a required argument: not optional, not defaulted, not nullable.
    if not principal:
        return {
            "results": [],
            "exposed": [],
            "revoked": [],
            "audit": {"principalId": None, "tenantId": None, "retrieved": []},
            "errors": ["retrieval requires a principal"],
        }

    def distance_of(chunk: dict) -> int:
        return abs(chunk["embedding"] - query["point"])

    def authorized(chunk: dict) -> bool:
        return (
            chunk["supersededAt"] is None
            # Deny by default: a missing tenant tag is unreachable, never universally readable.
            and chunk["tenantId"] is not None
            # The tenant comes from the principal. query["tenantId"] is never consulted.
            and chunk["tenantId"] == principal["tenantId"]
            and any(group in principal["groups"] for group in chunk["acl"])
        )

    ordered = sorted(index["chunks"], key=lambda c: (distance_of(c), c["id"]))

    exposed = []
    if config["enforcement"] == "post":
        # Everything in the window was read out of storage, authorized or not.
        window = ordered[: index["probe"]]
        exposed = [c["documentId"] for c in window if not authorized(c)]
        candidates = [c for c in window if authorized(c)]
    else:
        candidates = [c for c in ordered if authorized(c)]

    revoked = []
    if config["lateBinding"]:
        survivors = []
        for chunk in candidates:
            # The indexed ACL is a copy. Verify each survivor against the live source.
            live = index["liveAcls"].get(chunk["documentId"], [])
            if any(group in principal["groups"] for group in live):
                survivors.append(chunk)
            else:
                revoked.append(chunk["documentId"])
    else:
        survivors = candidates

    results = [
        {
            "id": chunk["id"],
            "documentId": chunk["documentId"],
            "version": chunk["version"],
            "distance": distance_of(chunk),
        }
        for chunk in survivors[: query["k"]]
    ]

    return {
        "results": results,
        "exposed": exposed,
        "revoked": revoked,
        # Audit at the source. Generated prose cannot be audited after the fact.
        "audit": {
            "principalId": principal["id"],
            "tenantId": principal["tenantId"],
            "retrieved": [hit["documentId"] for hit in results],
        },
        "errors": [],
    }
