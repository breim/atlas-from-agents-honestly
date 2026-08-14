export interface Doc {
  id: string;
  terms: string[];
}

export interface Hit {
  id: string;
  score: number;
}

export function search(
  query: string[],
  docs: Doc[],
  idf: Record<string, number>,
  topK: number,
): Hit[] {
  const terms = [...new Set(query)];

  return docs
    .map((doc) => ({
      id: doc.id,
      score: terms.reduce((sum, term) => {
        const tf = doc.terms.filter((word) => word === term).length;
        return sum + tf * (idf[term] ?? 0);
      }, 0),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK);
}
