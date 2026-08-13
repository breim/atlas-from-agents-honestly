import { Unimplemented } from '#harness';

export interface Route {
  name: string;
  any: string[];
}

export function route(_request: string, _routes: Route[], _fallback: string): string {
  throw new Unimplemented('route');
}
