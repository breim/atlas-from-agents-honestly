export interface Profile {
  tools: string[];
  instructions: string[];
  namespace: string | null;
}

export interface Catalogue {
  systemTokens: number;
  tools: Record<string, number>;
  instructions: Record<string, number>;
}

export interface RunStep {
  category?: string;
  calls: string[];
  additions: string[];
  variableTokens: number;
}

export interface Run {
  category: string;
  steps: RunStep[];
}

export interface Config {
  cacheReadBps: number;
  selectPerRequest: boolean;
}

export interface StepReport {
  step: number;
  prefixTokens: number;
  variableTokens: number;
  cached: boolean;
  billedTokens: number;
  refused: string[];
}

export interface Selection {
  namespace: string | null;
  steps: StepReport[];
  billedTokens: number;
  offered: string[];
  used: string[];
  neverCalled: string[];
  refused: string[];
}

export function select(
  run: Run,
  profiles: Record<string, Profile>,
  catalogue: Catalogue,
  config: Config,
): Selection {
  const profileFor = (category: string) => profiles[category] ?? profiles.default;
  const chosen = profileFor(run.category);

  const prefixOf = (profile: Profile) =>
    catalogue.systemTokens +
    profile.tools.reduce((total, tool) => total + catalogue.tools[tool], 0) +
    profile.instructions.reduce((total, name) => total + catalogue.instructions[name], 0);

  const offered: string[] = [];
  const used: string[] = [];
  const refused: string[] = [];
  const loadable = new Set<string>();
  const steps: StepReport[] = [];
  let previousPrefix: number | null = null;

  run.steps.forEach((step, index) => {
    // Per conversation, the profile is decided once at triage and held.
    const profile = config.selectPerRequest ? profileFor(step.category ?? run.category) : chosen;
    for (const tool of profile.tools) {
      if (!loadable.has(tool)) {
        loadable.add(tool);
        offered.push(tool);
      }
    }

    // Surfaced mid-run, an addition lands after the breakpoint rather than at position zero.
    let additionTokens = 0;
    for (const tool of step.additions) {
      additionTokens += catalogue.tools[tool];
      if (!loadable.has(tool)) {
        loadable.add(tool);
        offered.push(tool);
      }
    }

    const prefixTokens = prefixOf(profile);
    const cached = previousPrefix !== null && previousPrefix === prefixTokens;
    const variableTokens = step.variableTokens + additionTokens;
    const prefixCost = cached
      ? Math.floor((prefixTokens * config.cacheReadBps) / 10000 + 0.5)
      : prefixTokens;

    const stepRefused: string[] = [];
    for (const call of step.calls) {
      // A tool that is not loaded cannot be called.
      if (!loadable.has(call)) {
        stepRefused.push(call);
        if (!refused.includes(call)) refused.push(call);
        continue;
      }
      if (!used.includes(call)) used.push(call);
    }

    steps.push({
      step: index + 1,
      prefixTokens,
      variableTokens,
      cached,
      billedTokens: prefixCost + variableTokens,
      refused: stepRefused,
    });
    previousPrefix = prefixTokens;
  });

  return {
    namespace: chosen.namespace,
    steps,
    billedTokens: steps.reduce((total, step) => total + step.billedTokens, 0),
    offered,
    used,
    neverCalled: offered.filter((tool) => !used.includes(tool)),
    refused,
  };
}
