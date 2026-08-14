export interface Loop {
  owner: 'ai-sdk' | 'langgraph' | 'workflow';
  stopConditions: string[];
  maxSteps: number | null;
}

export interface Shape {
  name: 'one-tool-then-answer' | 'chat' | 'autonomous';
  suggestedMaxSteps: number;
}

export interface Runtime {
  language: 'typescript' | 'python';
  durabilityLives: 'ai-sdk' | 'langgraph' | 'workflow' | 'none';
  loops: Loop[];
  usesDeprecatedObjectApi: boolean;
}

export interface Policy {
  firstPartyStopConditions: string[];
  boundsYouOwn: string[];
  shapes: Shape[];
}

export interface Verdict {
  status: 'sound' | 'unsound';
  errors: string[];
  warnings: string[];
  loopOwner: string | null;
  boundsOwned: string[];
  boundsYours: string[];
}

export function place(runtime: Runtime, shape: Shape['name'], policy: Policy): Verdict {
  const errors: string[] = [];
  const warnings: string[] = [];

  // The SDK is TypeScript-only, which is why most systems split the two languages.
  if (runtime.language !== 'typescript') {
    errors.push('the AI SDK is typescript-only; the interface layer cannot be python');
  }

  // One loop, and it lives wherever durability lives.
  const loops = runtime.loops;
  if (loops.length === 0) errors.push('no loop owns the run');
  if (loops.length > 1) {
    errors.push(`${loops.length} loops means ${loops.length} step counters that disagree`);
  }
  const owner = loops.length === 1 ? loops[0].owner : null;
  if (owner && runtime.durabilityLives !== 'none' && owner !== runtime.durabilityLives) {
    errors.push(`the loop lives in ${owner} and durability lives in ${runtime.durabilityLives}`);
  }

  const declared = shape;
  const suggested = policy.shapes.find((item) => item.name === declared) as Shape;

  for (const loop of loops) {
    // A tool-augmented chat loops without an explicit stop condition, and the SDK requires one.
    if (loop.stopConditions.length === 0) errors.push(`${loop.owner} declares no stop condition`);
    if (loop.maxSteps === null) errors.push(`${loop.owner} declares no step cap`);
    else if (loop.maxSteps > suggested.suggestedMaxSteps) {
      warnings.push(`${loop.owner} allows ${loop.maxSteps} steps for a ${declared} shape`);
    }
  }

  // Only step count and a terminal tool call ship. Cost and deadline remain yours.
  const owned = [...new Set(loops.flatMap((loop) => loop.stopConditions))]
    .filter((condition) => policy.firstPartyStopConditions.includes(condition))
    .sort();
  const yours = [...policy.boundsYouOwn].sort();
  for (const bound of yours) {
    if (loops.some((loop) => loop.stopConditions.includes(bound))) continue;
    warnings.push(`${bound} is not a first-party stop condition and nothing here bounds it`);
  }

  if (runtime.usesDeprecatedObjectApi) {
    warnings.push('generateObject and streamObject are deprecated in v6; structured output moved onto generation');
  }

  return {
    status: errors.length > 0 ? 'unsound' : 'sound',
    errors,
    warnings,
    loopOwner: errors.length > 0 ? null : owner,
    boundsOwned: owned,
    boundsYours: yours,
  };
}
