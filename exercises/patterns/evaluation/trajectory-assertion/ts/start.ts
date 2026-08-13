import { Unimplemented } from '#harness';

export interface Spec {
  requires: string[];
  forbids: string[];
}

export interface Assertion {
  passed: boolean;
  violations: string[];
}

export function assertPath(_steps: string[], _spec: Spec): Assertion {
  throw new Unimplemented('assertPath');
}
