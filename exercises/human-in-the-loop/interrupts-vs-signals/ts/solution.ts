export type Step =
  | { kind: 'effect'; name: string }
  | { kind: 'interrupt'; name: string }
  | { kind: 'subgraph'; name: string; steps: Step[] };

export interface Program {
  steps: Step[];
}

export type Mechanism = 'langgraph' | 'temporal';

export interface Trace {
  effects: string[];
  executions: number;
  duplicated: string[];
}

type Leaf = { kind: 'effect' | 'interrupt'; name: string };

// Re-entry is from the top of the outermost node, so a subgraph is not a boundary.
const flatten = (steps: Step[]): Leaf[] =>
  steps.flatMap((step) => (step.kind === 'subgraph' ? flatten(step.steps) : [step]));

export function run(program: Program, mechanism: Mechanism): Trace {
  const leaves = flatten(program.steps);
  const pauses = leaves.filter((leaf) => leaf.kind === 'interrupt').length;
  const executions = mechanism === 'langgraph' ? pauses + 1 : 1;

  const effects: string[] = [];
  for (let pass = 0; pass < executions; pass += 1) {
    const stopAt = mechanism === 'langgraph' ? pass : pauses;
    let resumed = 0;
    for (const leaf of leaves) {
      if (leaf.kind === 'interrupt') {
        if (resumed === stopAt) break;
        resumed += 1;
        continue;
      }
      effects.push(leaf.name);
    }
  }

  const duplicated = [...new Set(effects)].filter(
    (name) => effects.filter((effect) => effect === name).length > 1,
  );

  return { effects, executions, duplicated };
}
