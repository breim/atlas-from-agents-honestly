export interface Rule {
  signal: string;
  store: string;
}

export function route(signals: string[], table: Rule[], fallback: string): string {
  // Table order, not signal order: the same question must always route the same way.
  const matched = table.find((rule) => signals.includes(rule.signal));

  return matched?.store ?? fallback;
}
