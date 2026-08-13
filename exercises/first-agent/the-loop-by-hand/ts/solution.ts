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

const isAnswer = (turn: Turn): turn is { text: string } => 'text' in turn;

export function runLoop({ script, tools, maxSteps }: LoopInput): LoopResult {
  const trace: LoopResult['trace'] = [];

  for (let step = 1; step <= maxSteps; step += 1) {
    const turn = script[step - 1];
    if (!turn) break;

    if (isAnswer(turn)) {
      return { status: 'completed', steps: step, answer: turn.text, trace };
    }

    trace.push({ tool: turn.tool, ok: Object.hasOwn(tools, turn.tool) });
  }

  return { status: 'bounded', steps: Math.min(maxSteps, script.length), answer: null, trace };
}
