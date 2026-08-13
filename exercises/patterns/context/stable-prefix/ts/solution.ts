export interface Block {
  id: string;
  tokens: number;
  volatile: boolean;
}

export interface Ordering {
  ordered: string[];
  prefixTokens: number;
}

export function order(blocks: Block[]): Ordering {
  const stable = blocks.filter((block) => !block.volatile);
  const volatile = blocks.filter((block) => block.volatile);

  return {
    ordered: [...stable, ...volatile].map((block) => block.id),
    prefixTokens: stable.reduce((sum, block) => sum + block.tokens, 0),
  };
}
