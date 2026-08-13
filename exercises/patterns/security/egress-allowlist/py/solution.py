from urllib.parse import urlparse


def _matches(host: str, entry: str) -> bool:
    """A leading dot matches subdomains only; anything else is an exact host."""
    return host.endswith(entry) if entry.startswith(".") else host == entry


def allowed(url: str, allow: list) -> dict:
    try:
        parsed = urlparse(url)
        host = parsed.hostname
    except ValueError:
        return {"allowed": False, "reason": "unparseable"}

    if not parsed.scheme or not host:
        return {"allowed": False, "reason": "unparseable"}
    if parsed.scheme != "https":
        return {"allowed": False, "reason": "scheme_not_allowed"}

    host = host.lower()
    if any(_matches(host, entry.lower()) for entry in allow):
        return {"allowed": True, "reason": None}
    return {"allowed": False, "reason": "host_not_allowed"}
