#!/usr/bin/env node
/**
 * The consistency gate between the book and this repository.
 *
 * Errors (exit 1):
 *   - an exercise directory with no coded chapter behind it;
 *   - an exercise missing one of its eight files;
 *   - a case in expected.json that only one language track asserts.
 *
 * Warnings (exit 0):
 *   - a coded chapter with no exercise directory yet;
 *   - an exercise scaffolded but not authored.
 *
 * The parity rule is the load-bearing one. Two tracks drift when someone adds a
 * case to expected.json and updates one test, and nothing else in the repository
 * would notice.
 */
import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(await readFile(join(root, 'book.json'), 'utf8'));
const exercises = join(root, 'exercises');

const REQUIRED = [
  'README.md',
  'expected.json',
  'ts/start.ts',
  'ts/solution.ts',
  'ts/exercise.test.ts',
  'py/start.py',
  'py/solution.py',
  'py/test_exercise.py',
];

const exists = (path) => access(path).then(() => true, () => false);
const errors = [];
const warnings = [];

/** Every directory holding an expected.json is an exercise, at whatever depth. */
const findExercises = async (dir, base = '') => {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = base ? `${base}/${entry.name}` : entry.name;
    if (await exists(join(dir, entry.name, 'expected.json'))) found.push(slug);
    else found.push(...(await findExercises(join(dir, entry.name), slug)));
  }
  return found;
};

const present = (await exists(exercises)) ? await findExercises(exercises) : [];
const coded = book.chapters.filter((c) => c.exercise && c.exercise !== 'read');
const codedSlugs = new Set(coded.map((c) => c.slug));

for (const slug of present) {
  if (!codedSlugs.has(slug)) {
    errors.push(`exercises/${slug} has no coded chapter in book.json`);
  }
}

for (const chapter of coded) {
  if (!present.includes(chapter.slug)) {
    warnings.push(`${chapter.slug} (${chapter.exercise}) has no exercise directory`);
  }
}

let authored = 0;

for (const slug of present.filter((s) => codedSlugs.has(s))) {
  const dir = join(exercises, slug);

  for (const file of REQUIRED) {
    if (!(await exists(join(dir, file)))) errors.push(`exercises/${slug} is missing ${file}`);
  }

  const fixture = JSON.parse(await readFile(join(dir, 'expected.json'), 'utf8'));
  if (fixture.chapter !== slug) {
    errors.push(`exercises/${slug}/expected.json names chapter ${JSON.stringify(fixture.chapter)}`);
  }

  if (!fixture.cases?.length) {
    warnings.push(`${slug} is scaffolded but has no cases`);
    continue;
  }
  authored += 1;

  const sources = await Promise.all([
    readFile(join(dir, 'ts/exercise.test.ts'), 'utf8').catch(() => ''),
    readFile(join(dir, 'py/test_exercise.py'), 'utf8').catch(() => ''),
  ]);

  for (const entry of fixture.cases) {
    const [ts, py] = sources.map((source) => source.includes(JSON.stringify(entry.id).slice(1, -1)));
    if (ts && py) continue;
    const missing = [!ts && 'TypeScript', !py && 'Python'].filter(Boolean).join(' and ');
    errors.push(`exercises/${slug} case ${JSON.stringify(entry.id)} is not asserted in ${missing}`);
  }
}

const LISTED = 10;
for (const warning of warnings.slice(0, LISTED)) console.warn(`  warn   ${warning}`);
if (warnings.length > LISTED) console.warn(`  warn   ...and ${warnings.length - LISTED} more`);
for (const error of errors) console.error(`  ERROR  ${error}`);

console.log(
  `\n${coded.length} coded chapters · ${present.length} scaffolded · ${authored} authored · ` +
    `${errors.length} error(s) · ${warnings.length} warning(s)`,
);

process.exit(errors.length ? 1 : 0);
