import { Unimplemented } from '#harness';

export interface Chunk {
  type: 'text' | 'tool_start' | 'tool_arg' | 'tool_end' | 'done';
  value?: string;
}

export interface ToolCall {
  name: string;
  args: string;
}

export interface Assembled {
  text: string;
  toolCalls: ToolCall[];
  complete: boolean;
}

export function assemble(_chunks: Chunk[]): Assembled {
  throw new Unimplemented('assemble');
}
