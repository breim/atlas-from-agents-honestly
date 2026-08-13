export interface Block {
  id: string;
  tokens: number;
  hash: string;
}

export interface Pricing {
  input: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Priced {
  cached: number;
  fresh: number;
  micros: number;
}

const same = (a: Block | undefined, b: Block | undefined): boolean =>
  a !== undefined && b !== undefined && a.id === b.id && a.tokens === b.tokens && a.hash === b.hash;

export function price(previous: Block[], current: Block[], pricing: Pricing): Priced {
  let shared = 0;
  while (shared < current.length && same(previous[shared], current[shared])) shared += 1;

  const total = (blocks: Block[]) => blocks.reduce((sum, block) => sum + block.tokens, 0);
  const cached = total(current.slice(0, shared));
  const fresh = total(current.slice(shared));

  return {
    cached,
    fresh,
    micros: Math.floor(cached * pricing.cacheRead + fresh * pricing.cacheWrite + 0.5),
  };
}
