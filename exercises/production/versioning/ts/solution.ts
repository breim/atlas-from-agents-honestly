export type Bundle = Record<string, string | number>;

export interface Environment {
  at: number;
  policyVersion: string;
  bundle: Bundle;
}

export interface Run {
  startedAt: number;
  actions: Array<{ name: string; at: number }>;
}

export interface Executed {
  configKey: string;
  actions: Array<{ name: string; at: number; configKey: string; policy: string }>;
}

// Content-addressed: the fields sorted by name, so two deploys producing the same
// bundle are the same configuration whatever the git history says.
export function configKey(bundle: Bundle): string {
  return Object.keys(bundle)
    .sort()
    .map((name) => `${name}=${bundle[name]}`)
    .join('|');
}

const activeAt = (environments: Environment[], at: number) =>
  environments.filter((entry) => entry.at <= at).at(-1)!;

export function execute(run: Run, environments: Environment[]): Executed {
  // Resolved once, at run start, and carried for the whole run.
  const carried = configKey(activeAt(environments, run.startedAt).bundle);

  return {
    configKey: carried,
    actions: run.actions.map((action) => ({
      name: action.name,
      at: action.at,
      configKey: carried,
      // Policy is the exception: it resolves at the moment of the action, or a run
      // that paused on Friday acts on Friday's permissions.
      policy: activeAt(environments, action.at).policyVersion,
    })),
  };
}
