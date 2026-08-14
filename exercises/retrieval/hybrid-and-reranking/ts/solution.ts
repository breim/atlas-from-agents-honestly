export interface Runs {
  semantic: string[];
  lexical: string[];
  hybrid: string[];
}

export interface Comparison {
  semanticBps: number;
  lexicalBps: number;
  hybridBps: number;
  verdict: 'gain' | 'no_gain' | 'regression';
}

function recall(run: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 10000;

  const wanted = new Set(relevant);
  const found = run.slice(0, k).filter((id) => wanted.has(id)).length;

  return Math.floor((found * 10000) / relevant.length + 0.5);
}

export function compare(runs: Runs, relevant: string[], k: number): Comparison {
  const semanticBps = recall(runs.semantic, relevant, k);
  const lexicalBps = recall(runs.lexical, relevant, k);
  const hybridBps = recall(runs.hybrid, relevant, k);

  // The bar is the better single retriever, not the one you happened to have first.
  const best = Math.max(semanticBps, lexicalBps);
  const verdict = hybridBps > best ? 'gain' : hybridBps === best ? 'no_gain' : 'regression';

  return { semanticBps, lexicalBps, hybridBps, verdict };
}
