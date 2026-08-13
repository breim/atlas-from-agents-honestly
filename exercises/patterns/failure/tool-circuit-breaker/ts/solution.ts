export interface Call {
  at: number;
  outcome: 'ok' | 'fail';
}

export interface Breaker {
  states: Array<'closed' | 'open' | 'half-open'>;
  reached: number[];
}

export function run(calls: Call[], threshold: number, cooldownMs: number): Breaker {
  const breaker: Breaker = { states: [], reached: [] };
  let open = false;
  let openedAt = 0;
  let failures = 0;

  for (const call of calls) {
    const probing = open && call.at - openedAt >= cooldownMs;
    const served = open ? (probing ? 'half-open' : 'open') : 'closed';
    breaker.states.push(served);

    if (served === 'open') continue;
    breaker.reached.push(call.at);

    if (call.outcome === 'ok') {
      open = false;
      failures = 0;
      continue;
    }

    failures = served === 'half-open' ? threshold : failures + 1;
    if (failures >= threshold) {
      open = true;
      openedAt = call.at;
    }
  }

  return breaker;
}
