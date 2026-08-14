def ingest(sources: list, index: dict, config: dict) -> dict:
    chunks = []
    manifest = {
        "attempted": len(sources),
        "parsed": 0,
        "failed": [],
        "rejected": [],
        "skipped": [],
        "reindexed": [],
        "tombstoned": [],
        "chunksProduced": 0,
        "sourceCount": len(sources),
        "indexedCount": 0,
    }

    def existing_for(document_id: str) -> list:
        return [c for c in index["chunks"] if c["documentId"] == document_id]

    for source in sources:
        # Garbage here is unfixable downstream, so it is named rather than skipped.
        if not source["parseOk"]:
            manifest["failed"].append(
                {"documentId": source["documentId"], "reason": source["parseError"]}
            )
            chunks.extend(existing_for(source["documentId"]))
            continue
        manifest["parsed"] += 1

        missing = [
            field
            for field in config["requiredMetadata"]
            if source.get(field) is None or source.get(field) == ""
        ]
        # A document that cannot be assigned a tenant fails ingestion, never indexed untagged.
        if missing:
            manifest["rejected"].append(
                {
                    "documentId": source["documentId"],
                    "reason": f"missing required metadata: {', '.join(missing)}",
                }
            )
            chunks.extend(existing_for(source["documentId"]))
            continue

        existing = existing_for(source["documentId"])
        # Hash the content. A timestamp moves for reasons unrelated to what the document says.
        unchanged = bool(existing) and all(
            chunk["contentHash"] == source["contentHash"]
            and chunk["pipelineVersion"] == config["pipelineVersion"]
            for chunk in existing
        )

        if unchanged:
            manifest["skipped"].append(source["documentId"])
            chunks.extend(existing)
            continue

        manifest["reindexed"].append(source["documentId"])
        for position in range(source["chunkCount"]):
            # Deterministic identity, so a re-run replaces rather than duplicates.
            chunks.append(
                {
                    "id": f"{source['documentId']}#{position}",
                    "documentId": source["documentId"],
                    "version": source["version"],
                    "tenantId": source["tenantId"],
                    "contentHash": source["contentHash"],
                    "pipelineVersion": config["pipelineVersion"],
                }
            )
            manifest["chunksProduced"] += 1

    # Nothing iterates over what no longer exists unless you write this part.
    present = {source["documentId"] for source in sources}
    for chunk in index["chunks"]:
        if (
            chunk["documentId"] not in present
            and chunk["documentId"] not in manifest["tombstoned"]
        ):
            manifest["tombstoned"].append(chunk["documentId"])

    manifest["indexedCount"] = len(chunks)
    return {"chunks": chunks, "manifest": manifest}
