export interface Spec {
  requires: string[];
  forbids: string[];
}

export interface Assertion {
  passed: boolean;
  violations: string[];
}

export function assertPath(steps: string[], spec: Spec): Assertion {
  const violations: string[] = [];

  for (const step of spec.requires) {
    if (!steps.includes(step)) violations.push(`missing:${step}`);
  }

  // Only steps that are actually present can be out of order; the rest are already missing.
  let cursor = 0;
  for (const step of spec.requires.filter((required) => steps.includes(required))) {
    const at = steps.indexOf(step, cursor);
    if (at === -1) violations.push(`out_of_order:${step}`);
    else cursor = at + 1;
  }

  for (const step of spec.forbids) {
    if (steps.includes(step)) violations.push(`forbidden:${step}`);
  }

  return { passed: violations.length === 0, violations };
}
