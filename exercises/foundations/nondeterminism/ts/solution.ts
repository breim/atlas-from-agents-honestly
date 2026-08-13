export interface Analysis {
  modal: string | null;
  modalCount: number;
  samples: number;
  agreementBps: number;
  stable: boolean;
}

export function analyse(samples: string[], consensusBps: number): Analysis {
  if (samples.length === 0) {
    return { modal: null, modalCount: 0, samples: 0, agreementBps: 0, stable: false };
  }

  const counts = new Map<string, number>();
  for (const sample of samples) counts.set(sample, (counts.get(sample) ?? 0) + 1);

  // Lexicographic tie-break, so a report about flakiness is not itself flaky.
  const [modal, modalCount] = [...counts].sort(
    ([answerA, countA], [answerB, countB]) => countB - countA || answerA.localeCompare(answerB),
  )[0];

  const agreementBps = Math.floor((modalCount * 10000) / samples.length + 0.5);

  return {
    modal,
    modalCount,
    samples: samples.length,
    agreementBps,
    stable: agreementBps >= consensusBps,
  };
}
