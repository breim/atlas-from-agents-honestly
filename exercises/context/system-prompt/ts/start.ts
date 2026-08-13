import { Unimplemented } from '#harness';

export interface Block {
  name: string;
  text: string;
}

export interface SpecEntry {
  name: string;
  required: boolean;
}

export interface Assembled {
  prompt: string;
  missing: string[];
  ignored: string[];
}

export function assemble(_blocks: Block[], _spec: SpecEntry[]): Assembled {
  throw new Unimplemented('assemble');
}
