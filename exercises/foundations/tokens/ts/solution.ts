export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export type Pricing = Usage;

const RATES = ['input', 'output', 'cacheWrite', 'cacheRead'] as const;

export function costMicros(usage: Usage, pricing: Pricing): number {
  const total = RATES.reduce((sum, rate) => sum + usage[rate] * pricing[rate], 0);
  return Math.floor(total + 0.5);
}
