export type Route = 'cache' | 'live';

export function route(cachedAt: number | null, now: number, maxAge: number): Route {
  if (cachedAt === null) return 'live';
  return now - cachedAt < maxAge ? 'cache' : 'live';
}
