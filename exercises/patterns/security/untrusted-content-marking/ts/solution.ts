export function ceiling(sources: string[], order: string[]): string {
  /** An unrecognised marking ranks at the bottom of the order, not off it. */
  const level = (source: string) => Math.max(0, order.indexOf(source));

  const lowest = sources.reduce((min, source) => Math.min(min, level(source)), order.length - 1);

  return order[lowest];
}
