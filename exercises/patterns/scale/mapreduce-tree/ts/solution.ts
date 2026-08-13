export interface Reduction {
  result: string | null;
  levels: string[][];
}

/** A lone item carries to the next level rather than joining a full group. */
const merge = (group: string[]): string => (group.length === 1 ? group[0] : `(${group.join('+')})`);

export function reduceTree(items: string[], fanIn: number): Reduction {
  const levels: string[][] = [];
  let current = items;

  while (current.length > 1) {
    const next: string[] = [];
    for (let start = 0; start < current.length; start += fanIn) {
      next.push(merge(current.slice(start, start + fanIn)));
    }
    levels.push(next);
    current = next;
  }

  return { result: current[0] ?? null, levels };
}
