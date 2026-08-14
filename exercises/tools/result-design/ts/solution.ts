export interface Field {
  name: string;
  tokens: number;
  essential: boolean;
}

export interface Shaped {
  kept: string[];
  dropped: string[];
  tokens: number;
  fits: boolean;
}

export function shape(present: string[], spec: Field[], budget: number): Shaped {
  const known = spec.filter((field) => present.includes(field.name));

  // Essentials are kept whatever they cost; going over budget is reported, not trimmed.
  const kept = known.filter((field) => field.essential);
  let tokens = kept.reduce((sum, field) => sum + field.tokens, 0);
  const fits = tokens <= budget;

  for (const field of known.filter((candidate) => !candidate.essential)) {
    if (tokens + field.tokens > budget) continue;
    tokens += field.tokens;
    kept.push(field);
  }

  const keptNames = new Set(kept.map((field) => field.name));

  return {
    kept: spec.filter((field) => keptNames.has(field.name)).map((field) => field.name),
    dropped: present.filter((name) => !keptNames.has(name)),
    tokens,
    fits,
  };
}
