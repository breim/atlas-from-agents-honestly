export interface Round {
  draft: string;
  resolves: string[];
  introduces: string[];
}

export interface Outcome {
  draft: string;
  accepted: string[];
  rejected: string[];
}

export function revise(draft: string, rounds: Round[]): Outcome {
  const outcome: Outcome = { draft, accepted: [], rejected: [] };

  for (const round of rounds) {
    if (round.resolves.length > 0 && round.introduces.length === 0) {
      outcome.draft = round.draft;
      outcome.accepted.push(round.draft);
    } else {
      outcome.rejected.push(round.draft);
    }
  }

  return outcome;
}
