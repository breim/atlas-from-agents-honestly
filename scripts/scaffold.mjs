#!/usr/bin/env node
/**
 * Creates the exercise directory for every coded chapter that does not have one.
 * Never touches a file that already exists — safe to re-run after every sync.
 *
 *   node scripts/scaffold.mjs                    every coded chapter
 *   node scripts/scaffold.mjs --tier micro       one tier
 *   node scripts/scaffold.mjs --only tools/idempotency
 *
 * A scaffolded exercise has an empty `cases` array, and both test files skip
 * themselves while that is true. Generating all of them therefore leaves the
 * suite green with skips rather than red with placeholders.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(await readFile(join(root, 'book.json'), 'utf8'));

const flag = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
};

const onlyTier = flag('tier');
const onlySlug = flag('only');
const exists = (path) => access(path).then(() => true, () => false);

const chapterUrl = (chapter) => `https://agentshonestly.com/book/${chapter.slug}`;

const TIER_BRIEF = {
  build: 'Adds a capability to the running Atlas system. Later chapters build on what you write here.',
  drill: 'A self-contained technique. Nothing outside this directory depends on it.',
  micro: 'One pattern, one property. Twenty to forty lines is the target.',
};

const readme = (chapter) => `# ${chapter.title}

**Tier:** ${chapter.exercise} — ${TIER_BRIEF[chapter.exercise]}

**Chapter:** [${chapter.partTitle} · ${chapter.title}](${chapterUrl(chapter)})

${chapter.desc}

## The task

_Not authored yet._ Describe what the reader implements, and name the property
the test proves rather than the code it expects.

## Run it

\`\`\`bash
npm run test:ts -- --test-name-pattern="${chapter.slug}"
python3.11 scripts/run-py-tests.py
\`\`\`

Grade the reference instead of your own work with \`ATLAS_SOLUTIONS=1\`.
`;

const expectedJson = (chapter) =>
  `${JSON.stringify({ chapter: chapter.slug, tier: chapter.exercise, cases: [] }, null, 2)}\n`;

const tsStart = (chapter) => `import { Unimplemented } from '#harness';

export function solve(_input: unknown): unknown {
  throw new Unimplemented('${chapter.slug}');
}
`;

const tsSolution = (chapter) => `export function solve(_input: unknown): unknown {
  throw new Error('${chapter.slug} solution is not authored yet');
}
`;

const tsTest = (chapter) => `import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, loadImpl } from '#harness';

const fixture = expected(import.meta.url);
const skip = fixture.cases.length === 0 && 'not authored yet';

test('${chapter.slug}', { skip }, async () => {
  const { solve } = await loadImpl<{ solve: (input: unknown) => unknown }>(import.meta.url);
  assert.ok(solve);
});
`;

const pyStart = (chapter) => `from atlas.harness import Unimplemented


def solve(_input):
    raise Unimplemented("${chapter.slug}")
`;

const pySolution = (chapter) => `def solve(_input):
    raise NotImplementedError("${chapter.slug} solution is not authored yet")
`;

const pyTest = (chapter) => `import unittest

from atlas.harness import expected, load_impl

FIXTURE = expected(__file__)


@unittest.skipIf(not FIXTURE["cases"], "not authored yet")
class Exercise(unittest.TestCase):
    def test_${chapter.slug.replaceAll(/[^a-z0-9]+/g, '_')}(self):
        impl = load_impl(__file__)
        self.assertTrue(callable(impl.solve))
`;

const files = (chapter) => ({
  'README.md': readme(chapter),
  'expected.json': expectedJson(chapter),
  'ts/start.ts': tsStart(chapter),
  'ts/solution.ts': tsSolution(chapter),
  'ts/exercise.test.ts': tsTest(chapter),
  'py/start.py': pyStart(chapter),
  'py/solution.py': pySolution(chapter),
  'py/test_exercise.py': pyTest(chapter),
});

const targets = book.chapters.filter((chapter) => {
  if (!chapter.exercise || chapter.exercise === 'read') return false;
  if (onlyTier && chapter.exercise !== onlyTier) return false;
  if (onlySlug && chapter.slug !== onlySlug) return false;
  return true;
});

if (onlySlug && targets.length === 0) {
  console.error(`no coded chapter with slug ${onlySlug}`);
  process.exit(1);
}

let created = 0;
for (const chapter of targets) {
  const dir = join(root, 'exercises', chapter.slug);
  for (const [name, contents] of Object.entries(files(chapter))) {
    const file = join(dir, name);
    if (await exists(file)) continue;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contents, 'utf8');
    created += 1;
  }
}

console.log(
  created
    ? `${created} file(s) created across ${targets.length} exercise(s).`
    : `nothing to scaffold — ${targets.length} exercise(s) already present.`,
);
