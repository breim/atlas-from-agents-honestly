export interface Param {
  name: string;
  required: boolean;
}

export interface Tool {
  name: string;
  effects: string[];
  params: Param[];
}

export interface Assessment {
  verdict: 'ok' | 'revise';
  issues: string[];
}

export function assess(tool: Tool, knownFields: string[], maxParams: number): Assessment {
  const issues: string[] = [];

  if (tool.effects.length === 0) issues.push(`no_effect:${tool.name}`);
  else if (tool.effects.length > 1) issues.push(`multiple_effects:${tool.name}`);

  for (const param of tool.params) {
    // Only required parameters are a problem: an optional one can simply be omitted.
    if (param.required && !knownFields.includes(param.name)) {
      issues.push(`undeterminable_param:${param.name}`);
    }
  }

  if (tool.params.length > maxParams) issues.push(`too_many_params:${tool.name}`);

  return { verdict: issues.length === 0 ? 'ok' : 'revise', issues };
}
