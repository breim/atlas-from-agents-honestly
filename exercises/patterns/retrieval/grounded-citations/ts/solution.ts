export interface Claim {
  text: string;
  cites: string[];
}

export function ground(claims: Claim[], sources: string[]): Claim[] {
  const retrieved = new Set(sources);

  return claims
    .map((claim) => ({
      text: claim.text,
      cites: [...new Set(claim.cites.filter((id) => retrieved.has(id)))],
    }))
    .filter((claim) => claim.cites.length > 0);
}
