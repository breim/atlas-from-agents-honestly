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

export interface Eviction {
  claimant: string;
  id: string;
  tokens: number;
}

export interface Allocation {
  status: 'ok' | 'trimmed' | 'over' | 'failed-build';
  breakdown: Breakdown;
  total: number;
  headroom: number;
  evicted: Eviction[];
  errors: string[];
}

const CONSTANTS = ['system', 'schemas'] as const;

interface Item {
  id: string;
  tokens: number;
}

const sum = (items: Item[]) => items.reduce((total, item) => total + item.tokens, 0);

// Evicts from the front of an already-ordered list until the rest fits.
function trim(items: Item[], allocation: number): { kept: Item[]; dropped: Item[] } {
  const kept = [...items];
  const dropped: Item[] = [];
  while (sum(kept) > allocation && kept.length > 0) {
    dropped.push(kept.shift() as Item);
  }
  return { kept, dropped };
}

export function allocate(request: Request, budget: Budget): Allocation {
  const allocationOf = (claimant: string) =>
    (budget.rows.find((row) => row.claimant === claimant) as Row).allocation;

  const raw: Breakdown = {
    system: request.system,
    schemas: request.schemas,
    documents: sum(request.documents),
    results: sum(request.results),
    history: sum(request.history),
    user: request.user,
  };

  const measure = (breakdown: Breakdown, evicted: Eviction[], errors: string[]): Allocation => {
    const total = Object.values(breakdown).reduce((running, value) => running + value, 0);
    const headroom = budget.window - budget.reserveOutput - total;
    const status = errors.length > 0 ? 'failed-build' : headroom < 0 ? 'over' : evicted.length > 0 ? 'trimmed' : 'ok';
    return { status, breakdown, total, headroom, evicted, errors };
  };

  // Constants are a code-review problem. Enforcing them at runtime admits nobody owns them.
  const errors = CONSTANTS.filter((claimant) => raw[claimant] > allocationOf(claimant)).map(
    (claimant) => `${claimant} is ${raw[claimant]} tokens against an allocation of ${allocationOf(claimant)}`,
  );
  if (errors.length > 0) return measure(raw, [], errors);

  // Oldest facts first, then oldest turns, then the lowest-ranked documents.
  const ordered: Record<string, Item[]> = {
    results: [...request.results].sort((left, right) => left.step - right.step),
    history: [...request.history].sort((left, right) => left.turn - right.turn),
    documents: [...request.documents].sort((left, right) => right.rank - left.rank),
  };

  const breakdown = { ...raw };
  const evicted: Eviction[] = [];

  for (const claimant of budget.evictionOrder) {
    const allocation = allocationOf(claimant);

    if (claimant === 'user') {
      if (breakdown.user > allocation) {
        evicted.push({ claimant, id: 'user-message', tokens: breakdown.user - allocation });
        breakdown.user = allocation;
      }
      continue;
    }

    const { kept, dropped } = trim(ordered[claimant], allocation);
    for (const item of dropped) evicted.push({ claimant, id: item.id, tokens: item.tokens });
    breakdown[claimant as 'results' | 'history' | 'documents'] = sum(kept);
  }

  return measure(breakdown, evicted, errors);
}
