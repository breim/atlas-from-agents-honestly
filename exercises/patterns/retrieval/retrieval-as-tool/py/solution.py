ACCEPTED = ("query", "topK")


def dispatch(args: dict, corpus: dict, max_top_k: int) -> dict:
    unknown = next((key for key in args if key not in ACCEPTED), None)
    if unknown is not None:
        return {
            "ok": False,
            "error": "unknown_argument",
            "message": f"unknown argument {unknown}; accepted arguments are {', '.join(ACCEPTED)}",
        }

    query = args.get("query")
    if not isinstance(query, str) or not query.strip():
        return {
            "ok": False,
            "error": "missing_argument",
            "message": "query is required and must be a non-empty string",
        }

    top_k = args.get("topK")
    if not isinstance(top_k, int) or isinstance(top_k, bool) or not 1 <= top_k <= max_top_k:
        return {
            "ok": False,
            "error": "out_of_range",
            "message": f"topK must be an integer between 1 and {max_top_k}",
        }

    return {"ok": True, "hits": corpus.get(query, [])[:top_k]}
