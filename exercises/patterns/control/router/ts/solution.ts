export interface Route {
  name: string;
  any: string[];
}

const words = (request: string): Set<string> =>
  new Set(request.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

export function route(request: string, routes: Route[], fallback: string): string {
  const present = words(request);
  const match = routes.find((candidate) => candidate.any.some((word) => present.has(word)));

  return match?.name ?? fallback;
}
