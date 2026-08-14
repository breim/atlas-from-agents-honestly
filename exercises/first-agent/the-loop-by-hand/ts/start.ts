import { Unimplemented } from '#harness';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, string>;
}

export type Block = TextBlock | ToolUseBlock;

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: true;
}

export interface Response {
  stopReason: 'tool_use' | 'end_turn';
  costCents: number;
  tookMs: number;
  content: Block[];
}

export interface Ticket {
  id: string;
  body: string;
  customerId: string;
}

export interface Config {
  maxSteps: number;
  maxCostCents: number;
  deadlineMs: number;
  maxResultChars: number;
}

export interface World {
  catalogue: Array<{ name: string; argument: string }>;
  records: Record<string, { customerId: string | null; data: string }>;
}

export interface Step {
  step: number;
  messages: number;
  calls: string[];
  results: ToolResultBlock[];
}

export interface Outcome {
  status: 'answered' | 'escalated' | 'halted';
  bound: 'steps' | 'cost' | 'deadline' | null;
  reply: string | null;
  reason: string | null;
  steps: number;
  costCents: number;
  elapsedMs: number;
  messages: number;
  trace: Step[];
}

export function run(ticket: Ticket, script: Response[], config: Config, world: World): Outcome {
  throw new Unimplemented('run');
}
