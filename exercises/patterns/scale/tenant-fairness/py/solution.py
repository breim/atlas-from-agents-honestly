def schedule(queue: list) -> list:
    by_tenant: dict = {}
    for entry in queue:
        by_tenant.setdefault(entry["tenant"], []).append(entry["task"])

    order: list = []
    while by_tenant:
        for tenant in list(by_tenant):
            order.append(by_tenant[tenant].pop(0))
            if not by_tenant[tenant]:
                del by_tenant[tenant]

    return order
