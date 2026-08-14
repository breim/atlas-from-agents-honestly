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

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: true;
}

export type Block = TextBlock | ToolUseBlock;

export interface Response {
  stopReason: 'tool_use' | 'end_turn';
  content: Block[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | Block[] | ToolResultBlock[];
}

export interface Ticket {
  id: string;
  body: string;
}

export interface ToolSpec {
  name: string;
  argument: string;
}

export interface Answered {
  transcript: Message[];
  requests: number[];
  rounds: number;
  answer: string | null;
  outcome: 'answered' | 'unresolved';
}

export function answer(
  ticket: Ticket,
  script: Response[],
  catalogue: ToolSpec[],
  world: Record<string, string>,
): Answered {
  throw new Unimplemented('answer');
}
