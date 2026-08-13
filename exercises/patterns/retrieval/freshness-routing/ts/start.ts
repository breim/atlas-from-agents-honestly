import { Unimplemented } from '#harness';

export type Route = 'cache' | 'live';

export function route(_cachedAt: number | null, _now: number, _maxAge: number): Route {
  throw new Unimplemented('route');
}
