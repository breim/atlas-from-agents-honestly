import { Unimplemented } from '#harness';

export interface Verdict {
  allowed: boolean;
  reason: string | null;
}

export function allowed(_url: string, _allow: string[]): Verdict {
  throw new Unimplemented('allowed');
}
