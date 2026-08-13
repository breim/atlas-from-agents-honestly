export type Context = Record<string, unknown>;

const pick = (source: Context, keys: string[]): Context =>
  Object.fromEntries(keys.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));

export function isolate(parent: Context, allow: string[]): Context {
  return pick(parent, allow);
}

export function merge(parent: Context, result: Context, expose: string[]): Context {
  return { ...parent, ...pick(result, expose) };
}
