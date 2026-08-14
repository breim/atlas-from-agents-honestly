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

interface Message {
  role: 'user' | 'assistant';
  content: string | Block[] | ToolResultBlock[];
}

const ESCALATE = 'escalate_to_human';

function runTool(call: ToolUseBlock, ticket: Ticket, config: Config, world: World): ToolResultBlock {
  const fail = (reason: string): ToolResultBlock => ({
    type: 'tool_result',
    toolUseId: call.id,
    content: `Error: ${reason}`,
    isError: true,
  });

  const spec = world.catalogue.find((tool) => tool.name === call.name);
  if (!spec) return fail(`no tool named ${call.name}`);

  const key = call.input[spec.argument];
  if (key === undefined) return fail(`${call.name} requires ${spec.argument}`);

  const record = world.records[`${call.name}:${key}`];
  if (record === undefined) return fail(`${call.name} found no record for ${key}`);

  // The model chooses the arguments, so the tenancy filter lives here rather than in a prompt.
  if (record.customerId !== null && record.customerId !== ticket.customerId) {
    return fail(`${call.name} is not authorized for ${key}`);
  }

  return { type: 'tool_result', toolUseId: call.id, content: record.data.slice(0, config.maxResultChars) };
}

const textOf = (content: Block[]) =>
  content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

export function run(ticket: Ticket, script: Response[], config: Config, world: World): Outcome {
  const messages: Message[] = [{ role: 'user', content: ticket.body }];
  const trace: Step[] = [];
  let costCents = 0;
  let elapsedMs = 0;

  const exit = (
    status: Outcome['status'],
    extra: Partial<Outcome>,
  ): Outcome => ({
    status,
    bound: null,
    reply: null,
    reason: null,
    steps: trace.length,
    costCents,
    elapsedMs,
    messages: messages.length,
    trace,
    ...extra,
  });

  for (let step = 1; step <= config.maxSteps; step += 1) {
    // Before the call. A budget enforced after the spend is a report, not a limit.
    if (costCents > config.maxCostCents) return exit('halted', { bound: 'cost' });
    if (elapsedMs > config.deadlineMs) return exit('halted', { bound: 'deadline' });

    const response = script[trace.length];
    costCents += response.costCents;
    elapsedMs += response.tookMs;

    const calls = response.content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
    const entry: Step = { step, messages: messages.length, calls: calls.map((call) => call.name), results: [] };
    trace.push(entry);
    messages.push({ role: 'assistant', content: response.content });

    if (response.stopReason !== 'tool_use') {
      return exit('answered', { reply: textOf(response.content) });
    }

    // Terminal tool. It ends the turn it was asked for in, so nothing else in that turn runs.
    const handoff = calls.find((call) => call.name === ESCALATE);
    if (handoff) return exit('escalated', { reason: handoff.input.reason });

    entry.results = calls.map((call) => runTool(call, ticket, config, world));
    messages.push({ role: 'user', content: entry.results });
  }

  // Not falling out with whatever text was lying around. Halting is a result.
  return exit('halted', { bound: 'steps' });
}
