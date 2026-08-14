export interface Endpoint {
  id: string;
  fields: Record<string, number>;
}

export interface Design {
  name: string;
  description: string;
  notFor?: string;
  job: string[];
  returns: string[];
  args: string[];
}

export interface Policy {
  identityFields: string[];
  maxLiveTools: number;
  minDescriptionWords: number;
}

export interface Tool {
  name: string;
  arguments: string[];
  returns: string[];
  roundTrips: number;
  endpoints: number;
  tokens: number;
}

export interface Totals {
  toolCount: number;
  roundTrips: number;
  tokens: number;
}

export interface Surface {
  tools: Tool[];
  rejected: Array<{ name: string; reason: string }>;
  warnings: string[];
  generated: Totals;
  curated: Totals;
}

export function surface(endpoints: Endpoint[], design: Design[], policy: Policy): Surface {
  const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));

  const tools: Tool[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const warnings: string[] = [];

  for (const proposed of design) {
    // Arguments come from the model; authority does not, so it is never in the schema.
    const identity = proposed.args.find((arg) => policy.identityFields.includes(arg));
    if (identity) {
      rejected.push({ name: proposed.name, reason: `${identity} is authority, not an argument the model may choose` });
      continue;
    }

    // The description is shipped, and it is the routing logic.
    const words = proposed.description.trim().split(/\s+/).filter(Boolean).length;
    if (words < policy.minDescriptionWords) {
      rejected.push({ name: proposed.name, reason: `the description is the interface, and this one is ${words} words` });
      continue;
    }

    const missingEndpoint = proposed.job.find((id) => !byId.has(id));
    if (missingEndpoint) {
      rejected.push({ name: proposed.name, reason: `names an endpoint that does not exist: ${missingEndpoint}` });
      continue;
    }

    const available = new Map<string, number>();
    for (const id of proposed.job) {
      for (const [field, cost] of Object.entries((byId.get(id) as Endpoint).fields)) available.set(field, cost);
    }

    const unavailable = proposed.returns.find((field) => !available.has(field));
    if (unavailable) {
      rejected.push({ name: proposed.name, reason: `returns ${unavailable}, which no endpoint in its job produces` });
      continue;
    }

    if (!proposed.notFor) {
      warnings.push(`${proposed.name} states no boundary, so the model must guess when not to call it`);
    }

    tools.push({
      name: proposed.name,
      arguments: proposed.args,
      returns: proposed.returns,
      // A chain in a fixed order is one call, whatever it costs you behind the tool.
      roundTrips: 1,
      endpoints: proposed.job.length,
      tokens: proposed.returns.reduce((total, field) => total + (available.get(field) as number), 0),
    });
  }

  if (tools.length > policy.maxLiveTools) {
    warnings.push(`a surface of ${tools.length} tools exceeds the live budget of ${policy.maxLiveTools}`);
  }

  const everything = endpoints.reduce(
    (total, endpoint) => total + Object.values(endpoint.fields).reduce((sum, cost) => sum + cost, 0),
    0,
  );

  return {
    tools,
    rejected,
    warnings,
    generated: { toolCount: endpoints.length, roundTrips: endpoints.length, tokens: everything },
    curated: {
      toolCount: tools.length,
      roundTrips: tools.reduce((total, tool) => total + tool.roundTrips, 0),
      tokens: tools.reduce((total, tool) => total + tool.tokens, 0),
    },
  };
}
