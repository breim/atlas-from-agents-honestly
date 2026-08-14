from atlas.harness import Unimplemented


def canonical(args: dict) -> str:
    raise Unimplemented("canonical")


def idempotency_key(run_id: str, tool: str, args: dict, length: int) -> str:
    raise Unimplemented("idempotency_key")


def dispatch(attempts: list, ledger: dict, config: dict) -> dict:
    raise Unimplemented("dispatch")
