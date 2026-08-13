import { Unimplemented } from '#harness';

export interface Step {
  id: string;
  tool: string;
  needs: string[];
}

export interface Outcome {
  ok: boolean;
  error?: string;
  executed: string[];
}

export function run(_plan: Step[], _tools: string[]): Outcome {
  throw new Unimplemented('run');
}
