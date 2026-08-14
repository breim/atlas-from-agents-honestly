export interface Trial {
  id: string;
  forward: 'a' | 'b';
  reverse: 'a' | 'b';
}

export interface Comparison {
  a: number;
  b: number;
  winner: 'a' | 'b' | 'tie';
  inconsistent: string[];
  consistencyBps: number;
  positionBias: { first: number; second: number };
}

export function compare(trials: Trial[]): Comparison {
  // A trial that flipped told you about the judge's position, not about the candidates.
  const consistent = trials.filter((trial) => trial.forward === trial.reverse);
  const flipped = trials.filter((trial) => trial.forward !== trial.reverse);

  const a = consistent.filter((trial) => trial.forward === 'a').length;
  const b = consistent.length - a;

  const consistencyBps = trials.length === 0 ? 0 : Math.floor((consistent.length * 10000) / trials.length + 0.5);

  return {
    a,
    b,
    winner: a === b ? 'tie' : a > b ? 'a' : 'b',
    inconsistent: flipped.map((trial) => trial.id),
    consistencyBps,
    positionBias: {
      first: flipped.filter((trial) => trial.forward === 'a').length,
      second: flipped.filter((trial) => trial.forward === 'b').length,
    },
  };
}
