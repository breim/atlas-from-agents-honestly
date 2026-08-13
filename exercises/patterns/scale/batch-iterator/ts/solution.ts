export interface Batch {
  batch: string[];
  cursor: string | null;
  done: boolean;
}

export function nextBatch(items: string[], size: number, cursor: string | null): Batch {
  const start = cursor === null ? 0 : items.indexOf(cursor) + 1;
  const batch = items.slice(start, start + size);

  return {
    batch,
    cursor: batch.at(-1) ?? cursor,
    done: start + batch.length >= items.length,
  };
}
