export interface Tool {
  name: string;
  kind: 'search' | 'action';
  tokens: number;
  resident: boolean;
  keywords: string[];
}

export interface Assembled {
  ok: true;
  resident: string[];
  appended: string[];
  prefixTokens: number;
  totalTokens: number;
}

export interface Rejected {
  ok: false;
  error: 'no_resident_search' | 'no_resident_action';
}

const terms = (query: string) => new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

export function assemble(
  catalogue: Tool[],
  query: string,
  limit: number,
): Assembled | Rejected {
  const resident = catalogue.filter((tool) => tool.resident);
  if (!resident.some((tool) => tool.kind === 'search')) return { ok: false, error: 'no_resident_search' };
  if (!resident.some((tool) => tool.kind === 'action')) return { ok: false, error: 'no_resident_action' };

  const words = terms(query);
  const matches = catalogue
    .map((tool, index) => ({ tool, index, score: tool.keywords.filter((k) => words.has(k)).length }))
    .filter((entry) => !entry.tool.resident && entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.tool);

  const cost = (tools: Tool[]) => tools.reduce((sum, tool) => sum + tool.tokens, 0);
  const prefixTokens = cost(resident);

  return {
    ok: true,
    resident: resident.map((tool) => tool.name),
    appended: matches.map((tool) => tool.name),
    prefixTokens,
    totalTokens: prefixTokens + cost(matches),
  };
}
