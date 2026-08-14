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

function run(block: ToolUseBlock, catalogue: ToolSpec[], world: Record<string, string>): ToolResultBlock {
  const fail = (content: string): ToolResultBlock => ({
    type: 'tool_result',
    toolUseId: block.id,
    content: `Error: ${content}`,
    isError: true,
  });

  const spec = catalogue.find((tool) => tool.name === block.name);
  if (!spec) return fail(`no tool named ${block.name}`);

  const key = block.input[spec.argument];
  if (key === undefined) return fail(`${block.name} requires ${spec.argument}`);

  const record = world[`${block.name}:${key}`];
  if (record === undefined) return fail(`${block.name} found no record for ${key}`);

  return { type: 'tool_result', toolUseId: block.id, content: record };
}

const textOf = (content: Block[]) =>
  content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

export function answer(
  ticket: Ticket,
  script: Response[],
  catalogue: ToolSpec[],
  world: Record<string, string>,
): Answered {
  const transcript: Message[] = [{ role: 'user', content: ticket.body }];
  const requests: number[] = [];

  // Every request resends the whole history. Recording its size is the only way the
  // multiplier is visible from outside.
  const ask = () => {
    requests.push(transcript.length);
    return script[requests.length - 1];
  };

  let response = ask();
  let rounds = 0;

  // An `if`, not a `while`. The model chooses once, and only once.
  if (response.stopReason === 'tool_use') {
    // The model has no memory of asking; the request is the memory. Echo it verbatim.
    transcript.push({ role: 'assistant', content: response.content });

    const results = response.content
      .filter((block): block is ToolUseBlock => block.type === 'tool_use')
      .map((block) => run(block, catalogue, world));

    // Every result for the turn, in one user message. Rows enter the transcript in the
    // same slot as the customer's words.
    transcript.push({ role: 'user', content: results });
    rounds = 1;
    response = ask();
  }

  if (response.stopReason === 'tool_use') {
    return { transcript, requests, rounds, answer: null, outcome: 'unresolved' };
  }

  transcript.push({ role: 'assistant', content: response.content });
  return { transcript, requests, rounds, answer: textOf(response.content), outcome: 'answered' };
}
