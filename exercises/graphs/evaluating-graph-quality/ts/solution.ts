export interface Triple {
  from: string;
  type: string;
  to: string;
}

export interface Quality {
  precisionBps: number;
  recallBps: number;
  spurious: Triple[];
  missed: Triple[];
}

/** All three parts, so a wrong relation or a reversed direction is simply a different fact. */
const key = (triple: Triple): string => `${triple.from}|${triple.type}|${triple.to}`;

export function evaluate(extracted: Triple[], gold: Triple[]): Quality {
  const truth = new Set(gold.map(key));
  const claimed = new Set(extracted.map(key));

  const spurious = extracted.filter((triple) => !truth.has(key(triple)));
  const missed = gold.filter((triple) => !claimed.has(key(triple)));
  const correct = extracted.length - spurious.length;

  const bps = (numerator: number, denominator: number) =>
    denominator === 0 ? 10000 : Math.floor((numerator * 10000) / denominator + 0.5);

  return {
    precisionBps: bps(correct, extracted.length),
    recallBps: bps(gold.length - missed.length, gold.length),
    spurious,
    missed,
  };
}
