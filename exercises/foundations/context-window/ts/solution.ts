export interface Section {
  name: string;
  tokens: number;
}

export interface Plan {
  input: number;
  reserved: number;
  headroom: number;
  fits: boolean;
  overBy: number;
}

export function plan(sections: Section[], maxOutput: number, windowTokens: number): Plan {
  const input = sections.reduce((sum, section) => sum + section.tokens, 0);
  const headroom = windowTokens - input - maxOutput;

  return {
    input,
    reserved: maxOutput,
    headroom,
    fits: headroom >= 0,
    overBy: Math.max(0, -headroom),
  };
}
