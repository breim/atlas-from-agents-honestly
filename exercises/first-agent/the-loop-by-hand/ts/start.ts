import { Unimplemented } from '#harness';

export type Turn = { tool: string; input: Record<string, unknown> } | { text: string };

export interface LoopInput {
  script: Turn[];
  tools: Record<string, unknown>;
  maxSteps: number;
}

export interface LoopResult {
  status: 'completed' | 'bounded';
  steps: number;
  answer: string | null;
  trace: Array<{ tool: string; ok: boolean }>;
}

export function runLoop(_input: LoopInput): LoopResult {
  throw new Unimplemented('runLoop');
}
