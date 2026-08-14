export interface Round {
  draft: string;
  score: number;
  feedback: string;
}

export interface Outcome {
  best: string;
  score: number;
  rounds: number;
  stopped: 'converged' | 'stalled' | 'budget';
}

export function optimise(rounds: Round[], threshold: number, maxRounds: number): Outcome {
  let best = { draft: '', score: -Infinity };
  let consumed = 0;
  let previous: string | null = null;

  for (const round of rounds.slice(0, maxRounds)) {
    consumed += 1;
    if (round.score > best.score) best = { draft: round.draft, score: round.score };

    const stop = (stopped: Outcome['stopped']): Outcome => ({
      best: best.draft,
      score: best.score,
      rounds: consumed,
      stopped,
    });

    if (round.score >= threshold) return stop('converged');
    // Feedback that repeats means the loop has stopped learning.
    if (previous !== null && round.feedback === previous) return stop('stalled');
    previous = round.feedback;
  }

  return { best: best.draft, score: best.score, rounds: consumed, stopped: 'budget' };
}
