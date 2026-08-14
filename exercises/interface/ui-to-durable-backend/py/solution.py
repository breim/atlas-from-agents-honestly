def serve(request: dict, entitlements: dict, policy: dict) -> dict:
    errors = []

    # The API layer must not proxy identifiers from the browser.
    if request["workflowIdFromBrowser"]:
        errors.append("the browser supplied a workflow id, which it may not")
    # It must not hold the request open, nor start work on GET.
    if request["holdsRequestOpen"]:
        errors.append("the request was held open instead of returning")
    if request["method"] == "GET" and request["verb"] == "start":
        errors.append("work was started on a GET")
    # Credentials never travel in a buffered stream.
    if request["credentialsInStream"]:
        errors.append("credentials were put into a buffered stream")
    # Polling load scales with open tabs and peaks during the incident.
    if request["polling"] and request["verb"] == "query":
        errors.append("a query was polled; stream instead")

    if errors:
        return {
            "status": 500,
            "errors": errors,
            "workflowId": None,
            "source": None,
            "order": [],
        }

    def not_found():
        # Return 404 rather than 403, or you have confirmed the record exists.
        return {
            "status": 404,
            "errors": ["not found"],
            "workflowId": None,
            "source": None,
            "order": [],
        }

    if not request["principal"] or not request["businessId"]:
        return not_found()

    allowed = entitlements["entitled"].get(request["principal"], [])
    if request["businessId"] not in allowed:
        return not_found()

    # The browser sends the business identity; the API derives the workflow id.
    workflow_id = f"atlas-{request['businessId']}"

    if request["verb"] in ("start", "signal"):
        return {
            "status": 202,
            "errors": [],
            "workflowId": workflow_id,
            "source": "workflow",
            "order": [request["verb"]],
        }
    if request["verb"] in policy["readModelVerbs"]:
        # The read model backs the list; a stale row there is cosmetic.
        return {
            "status": 200,
            "errors": [],
            "workflowId": None,
            "source": "read-model",
            "order": ["read-model"],
        }
    if request["verb"] == "reconnect":
        # Stream-first: open the stream, snapshot, render, reconcile buffered events by id.
        return {
            "status": 200,
            "errors": [],
            "workflowId": workflow_id,
            "source": "stream",
            "order": ["open-stream", "snapshot", "render", "reconcile"],
        }
    # A query backs the detail view, once, on cold load.
    return {
        "status": 200,
        "errors": [],
        "workflowId": workflow_id,
        "source": "workflow",
        "order": ["query"],
    }
