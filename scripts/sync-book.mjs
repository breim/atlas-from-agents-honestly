#!/usr/bin/env node
/**
 * Regenerates book.json from the book repository.
 *
 * The book is the source of truth for structure: which chapters exist, their
 * order, their titles, and which ones sit on the core path. This repository is
 * the source of truth for one field the book knows nothing about — the exercise
 * tier — which lives in tiers.json and is merged in here.
 *
 *   BOOK_PATH=../agents-honestly node scripts/sync-book.mjs
 *
 * Run it with --check to fail instead of writing when the result would differ.
 * That is the drift guard: a renamed slug in the book breaks this before it
 * breaks a reader's link.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bookPath = process.env.BOOK_PATH ?? join(root, '..', 'agents-honestly');
const docs = join(bookPath, 'content/docs');
const checkOnly = process.argv.includes('--check');

const TIERS = ['build', 'drill', 'micro', 'read'];

/** Fumadocs drops parenthesised segments when building a slug: `(start-here)/preface` → `preface`. */
const toSlug = (dir, page) => {
  const segments = dir ? dir.split('/').filter((s) => !s.startsWith('(')) : [];
  return [...segments, page].join('/');
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

/**
 * Frontmatter only, and only two keys. A real YAML parser would be a dependency
 * for the privilege of reading `title:` off the top of a file.
 */
const frontmatter = (source) => {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};
  const out = {};
  for (const line of block[1].split(/\r?\n/)) {
    const field = line.match(/^(title|description):\s*(.*)$/);
    if (!field) continue;
    const raw = field[2].trim();
    out[field[1]] = raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : raw;
  }
  return out;
};

/** The core path is prose, but its numbered entries are a stable, parseable list. */
const readCorePath = async () => {
  const source = await readFile(join(docs, '(start-here)/core-path.mdx'), 'utf8');
  const slugs = [...source.matchAll(/^\d+\.\s+\[[^\]]+\]\(\/book\/([^)\s]+)\)/gm)].map((m) => m[1]);
  return new Set(slugs);
};

const readChapters = async (dir, partTitle) => {
  const meta = await readJson(join(docs, dir, 'meta.json'));
  const chapters = [];
  for (const page of meta.pages) {
    const source = await readFile(join(docs, dir, `${page}.mdx`), 'utf8');
    const { title, description } = frontmatter(source);
    chapters.push({ slug: toSlug(dir, page), part: dir, partTitle, title, desc: description });
  }
  return chapters;
};

/** `patterns/meta.json` lists directories rather than pages; every other part lists pages. */
const listsDirectories = async (dir, meta) =>
  readFile(join(docs, dir, `${meta.pages[0]}.mdx`), 'utf8').then(() => false, () => true);

const build = async () => {
  const rootMeta = await readJson(join(docs, 'meta.json'));
  const entries = rootMeta.pages.filter((page) => page !== 'index' && page !== '...');

  const parts = [];
  const chapters = [];

  for (const dir of entries) {
    const meta = await readJson(join(docs, dir, 'meta.json'));
    if (await listsDirectories(dir, meta)) {
      const groups = [];
      for (const group of meta.pages) {
        const groupDir = `${dir}/${group}`;
        const groupMeta = await readJson(join(docs, groupDir, 'meta.json'));
        const groupChapters = await readChapters(groupDir, groupMeta.title);
        groups.push({ dir: groupDir, title: groupMeta.title, chapters: groupChapters.length });
        chapters.push(...groupChapters);
      }
      parts.push({ dir, title: meta.title, groups });
    } else {
      const partChapters = await readChapters(dir, meta.title);
      parts.push({ dir, title: meta.title, chapters: partChapters.length });
      chapters.push(...partChapters);
    }
  }

  const core = await readCorePath();
  const unknownCore = [...core].filter((slug) => !chapters.some((c) => c.slug === slug));
  if (unknownCore.length) {
    throw new Error(`core-path.mdx links slugs that are not chapters: ${unknownCore.join(', ')}`);
  }

  const tiers = await readJson(join(root, 'tiers.json')).catch(() => ({}));
  const missing = chapters.filter((c) => !(c.slug in tiers)).map((c) => c.slug);
  const orphaned = Object.keys(tiers).filter((slug) => !chapters.some((c) => c.slug === slug));
  const invalid = Object.entries(tiers).filter(([, tier]) => !TIERS.includes(tier)).map(([slug]) => slug);

  for (const chapter of chapters) {
    chapter.core = core.has(chapter.slug);
    chapter.exercise = tiers[chapter.slug] ?? null;
  }

  return {
    output: {
      source: 'github.com/breim/agents-honestly',
      generatedBy: 'scripts/sync-book.mjs',
      counts: {
        parts: parts.length,
        chapters: chapters.length,
        core: core.size,
        coded: chapters.filter((c) => c.exercise && c.exercise !== 'read').length,
      },
      structure: parts,
      chapters,
    },
    problems: { missing, orphaned, invalid },
  };
};

const { output, problems } = await build();
const { counts } = output;
const serialised = `${JSON.stringify(output, null, 2)}\n`;
const target = join(root, 'book.json');
const previous = await readFile(target, 'utf8').catch(() => null);

if (checkOnly) {
  if (previous !== serialised) {
    console.error('book.json is stale — run `npm run sync` and commit the result.');
    process.exit(1);
  }
  console.log(`book.json current — ${counts.chapters} chapters, ${counts.parts} parts.`);
} else {
  await writeFile(target, serialised, 'utf8');
  console.log(
    `book.json written — ${counts.chapters} chapters, ${counts.parts} parts, ${counts.core} core, ${counts.coded} coded.`,
  );
}

let failed = false;
for (const [label, slugs] of Object.entries(problems)) {
  if (!slugs.length) continue;
  failed = true;
  console.error(`\n${slugs.length} slug(s) ${label} in tiers.json:`);
  for (const slug of slugs) console.error(`  ${slug}`);
}
if (failed) process.exit(1);
