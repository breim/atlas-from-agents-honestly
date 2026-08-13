export interface Attempt {
  ok: boolean;
  processed: string[];
  checkpoint: string | null;
}

export function process(
  items: string[],
  checkpoint: string | null,
  failAt: string | null,
): Attempt {
  const resumeFrom = checkpoint === null ? -1 : items.indexOf(checkpoint);
  const processed: string[] = [];
  let mark = checkpoint === null || resumeFrom === -1 ? null : checkpoint;

  for (const item of items.slice(resumeFrom + 1)) {
    if (item === failAt) return { ok: false, processed, checkpoint: mark };
    processed.push(item);
    mark = item;
  }

  return { ok: true, processed, checkpoint: mark };
}
