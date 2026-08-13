export function delays(randoms: number[], baseMs: number, capMs: number): number[] {
  return randoms.map((draw, index) =>
    Math.floor(draw * Math.min(baseMs * 2 ** index, capMs)),
  );
}
