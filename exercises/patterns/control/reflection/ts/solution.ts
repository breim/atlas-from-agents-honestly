export interface Round {
  draft: string;
  score: number;
}

export interface Outcome {
  draft: string;
  score: number;
  rounds: number;
  stopped: 'threshold' | 'budget';
}

export function reflect(rounds: Round[], threshold: number, maxRounds: number): Outcome {
  let best: Round = { draft: '', score: -Infinity };
  let consumed = 0;

  for (const round of rounds.slice(0, maxRounds)) {
    consumed += 1;
    if (round.score > best.score) best = round;
    if (round.score >= threshold) {
      return { draft: best.draft, score: best.score, rounds: consumed, stopped: 'threshold' };
    }
  }

  return { draft: best.draft, score: best.score, rounds: consumed, stopped: 'budget' };
}
