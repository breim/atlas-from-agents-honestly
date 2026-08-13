export interface Verdict {
  allowed: boolean;
  reason: string | null;
}

/** A leading dot matches subdomains only; anything else is an exact host. */
const matches = (host: string, entry: string): boolean =>
  entry.startsWith('.') ? host.endsWith(entry) : host === entry;

export function allowed(url: string, allow: string[]): Verdict {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'unparseable' };
  }

  if (!parsed.hostname) return { allowed: false, reason: 'unparseable' };
  if (parsed.protocol !== 'https:') return { allowed: false, reason: 'scheme_not_allowed' };

  const host = parsed.hostname.toLowerCase();
  const permitted = allow.some((entry) => matches(host, entry.toLowerCase()));

  return permitted ? { allowed: true, reason: null } : { allowed: false, reason: 'host_not_allowed' };
}
