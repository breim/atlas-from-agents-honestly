export interface Candidate {
  key: string;
  value: string;
  sources: string[];
}

export interface Admission {
  admitted: boolean;
  reason: string | null;
}

export function admit(
  candidate: Candidate,
  pinned: Record<string, string>,
  trusted: string[],
): Admission {
  // Unattributed is untrusted, so an empty source list fails the `every` check by design.
  const attributed =
    candidate.sources.length > 0 && candidate.sources.every((source) => trusted.includes(source));
  if (!attributed) return { admitted: false, reason: 'untrusted_source' };

  const pin = pinned[candidate.key];
  if (pin !== undefined && pin !== candidate.value) {
    return { admitted: false, reason: 'contradicts_pinned' };
  }

  return { admitted: true, reason: null };
}
