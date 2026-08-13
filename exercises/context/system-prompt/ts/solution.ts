export interface Block {
  name: string;
  text: string;
}

export interface SpecEntry {
  name: string;
  required: boolean;
}

export interface Assembled {
  prompt: string;
  missing: string[];
  ignored: string[];
}

export function assemble(blocks: Block[], spec: SpecEntry[]): Assembled {
  const known = new Set(spec.map((entry) => entry.name));
  const chosen = new Map<string, string>();
  const ignored: string[] = [];

  for (const block of blocks) {
    // Unknown or already supplied: the spec decides, and the first block wins.
    if (!known.has(block.name) || chosen.has(block.name)) {
      ignored.push(block.name);
      continue;
    }
    chosen.set(block.name, block.text);
  }

  return {
    prompt: spec
      .filter((entry) => chosen.has(entry.name))
      .map((entry) => chosen.get(entry.name))
      .join('\n\n'),
    missing: spec.filter((entry) => entry.required && !chosen.has(entry.name)).map((e) => e.name),
    ignored,
  };
}
