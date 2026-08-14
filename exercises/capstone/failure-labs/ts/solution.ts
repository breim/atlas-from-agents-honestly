export interface Lab {
  name: string;
  fault: string | null;
  window: string | null;
  invariant: string | null;
  evidence: string[];
  inspects: 'return-status' | 'effect-state';
  assertsBefore: string[];
  bypass: 'attempted' | 'admitted' | null;
  boundHasTerminalPolicy: boolean;
  promotedTo: 'unit' | 'integration' | 'lab' | null;
  artifactsPreserved: boolean;
}

export interface Policy {
  required: string[];
  isolationCheckpoints: string[];
  layers: string[];
}

export interface Verdict {
  lab: string;
  status: 'valid' | 'invalid';
  errors: string[];
  promotedTo: string | null;
}

export interface Report {
  status: 'complete' | 'incomplete';
  verdicts: Verdict[];
  admittedBypasses: string[];
  attemptedBypasses: string[];
}

export function assess(labs: Lab[], policy: Policy): Report {
  const verdicts = labs.map((lab) => {
    const errors: string[] = [];

    // Define fault, window, invariant and evidence before injecting anything.
    for (const field of policy.required) {
      const value = lab[field as 'fault' | 'window' | 'invariant'];
      if (!value) errors.push(`${lab.name} declares no ${field}`);
    }
    if (lab.evidence.length === 0) errors.push(`${lab.name} collects no evidence`);

    // Inspect effect state, not only return status.
    if (lab.inspects !== 'effect-state') errors.push(`${lab.name} inspects only the return status`);

    // Assert tenant isolation before reranking, prompt assembly and every graph hop.
    for (const checkpoint of policy.isolationCheckpoints) {
      if (!lab.assertsBefore.includes(checkpoint)) {
        errors.push(`${lab.name} does not assert isolation before ${checkpoint}`);
      }
    }

    // Every bound needs a terminal business policy.
    if (!lab.boundHasTerminalPolicy) errors.push(`${lab.name} bounds something with no terminal policy`);

    // Promote each finding to the lowest layer that can prevent it.
    if (!lab.promotedTo) errors.push(`${lab.name} promotes its finding nowhere`);
    else if (!policy.layers.includes(lab.promotedTo)) errors.push(`${lab.name} promotes to an unknown layer`);

    // Preserve the failed artifacts before cleanup or re-run.
    if (!lab.artifactsPreserved) errors.push(`${lab.name} cleans up before preserving its artifacts`);

    return {
      lab: lab.name,
      status: errors.length > 0 ? ('invalid' as const) : ('valid' as const),
      errors,
      promotedTo: errors.length > 0 ? null : lab.promotedTo,
    };
  });

  // Separate attempted bypass from admitted bypass.
  const attempted = labs.filter((lab) => lab.bypass === 'attempted').map((lab) => lab.name);
  const admitted = labs.filter((lab) => lab.bypass === 'admitted').map((lab) => lab.name);

  return {
    status: verdicts.some((verdict) => verdict.status === 'invalid') || admitted.length > 0 ? 'incomplete' : 'complete',
    verdicts,
    admittedBypasses: admitted,
    attemptedBypasses: attempted,
  };
}
