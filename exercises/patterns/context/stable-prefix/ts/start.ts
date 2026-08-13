import { Unimplemented } from '#harness';

export interface Block {
  id: string;
  tokens: number;
  volatile: boolean;
}

export interface Ordering {
  ordered: string[];
  prefixTokens: number;
}

export function order(_blocks: Block[]): Ordering {
  throw new Unimplemented('order');
}
