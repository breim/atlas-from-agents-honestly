export function rewrite(query: string, synonyms: Record<string, string[]>): string {
  const terms = query.split(/\s+/).filter(Boolean);
  const expanded = new Set(terms);

  for (const term of terms) {
    for (const synonym of synonyms[term] ?? []) expanded.add(synonym);
  }

  return [...expanded].join(' ');
}
