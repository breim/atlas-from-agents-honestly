import { Unimplemented } from '#harness';

export interface Admission {
  admitted: number[];
  rejected: number[];
}

export function admit(
  _arrivals: number[],
  _capacity: number,
  _refillMsPerToken: number,
): Admission {
  throw new Unimplemented('admit');
}
