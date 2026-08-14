export type Reversibility = 'reversible' | 'costly' | 'irreversible';
export type Posture = 'auto' | 'notify' | 'approve' | 'dual';

export interface Tool {
  reversibility: Reversibility;
  templatedReversibility?: Reversibility;
  radiusThresholds: number[];
}

export interface Call {
  tool: string;
  scope: number;
  templated: boolean;
  count: number;
}

export interface Assessment {
  decisions: Array<{ tool: string; posture: Posture }>;
  approvals: number;
  affordable: boolean;
}

const POSTURE: Record<Reversibility, [Posture, Posture, Posture]> = {
  //              small      moderate   large
  reversible: ['auto', 'notify', 'approve'],
  costly: ['notify', 'approve', 'dual'],
  irreversible: ['approve', 'dual', 'dual'],
};

const DECISIONS: Record<Posture, number> = { auto: 0, notify: 0, approve: 1, dual: 2 };

export function assess(
  calls: Call[],
  catalogue: Record<string, Tool>,
  capacity: number,
): Assessment {
  const decisions = calls.map((call) => {
    const tool = catalogue[call.tool];

    // Reversibility is a property of the action. The same tool sending an approved
    // template and sending model-authored prose are two different risks.
    const reversibility =
      call.templated && tool.templatedReversibility ? tool.templatedReversibility : tool.reversibility;

    const radius = Math.min(tool.radiusThresholds.filter((edge) => call.scope >= edge).length, 2);

    return { tool: call.tool, posture: POSTURE[reversibility][radius] };
  });

  const approvals = decisions.reduce(
    (total, decision, index) => total + DECISIONS[decision.posture] * calls[index].count,
    0,
  );

  return { decisions, approvals, affordable: approvals <= capacity };
}
