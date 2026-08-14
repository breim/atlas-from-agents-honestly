import { Unimplemented } from '#harness';

export interface Document {
  id: string;
  rank: number;
  tokens: number;
}

export interface Result {
  id: string;
  step: number;
  tokens: number;
}

export interface Turn {
  id: string;
  turn: number;
  tokens: number;
}

export interface Request {
  system: number;
  schemas: number;
  documents: Document[];
  results: Result[];
  history: Turn[];
  user: number;
}

export interface Row {
  claimant: string;
  allocation: number;
  policy: string;
}

export interface Budget {
  window: number;
  reserveOutput: number;
  rows: Row[];
  evictionOrder: string[];
}

export interface Breakdown {
  system: number;
  schemas: number;
  documents: number;
  results: number;
  history: number;
  user: number;
}

export interface Allocation {
  status: 'ok' | 'trimmed' | 'over' | 'failed-build';
  breakdown: Breakdown;
  total: number;
  headroom: number;
  evicted: Array<{ claimant: string; id: string; tokens: number }>;
  errors: string[];
}

export function allocate(request: Request, budget: Budget): Allocation {
  throw new Unimplemented('allocate');
}
