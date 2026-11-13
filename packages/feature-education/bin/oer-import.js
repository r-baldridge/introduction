#!/usr/bin/env node
/**
 * Open Content Importer CLI.
 *
 *   oer-import file <path.md|.csv|.tsv> [--out dir] [metadata flags]
 *   oer-import wiki "<Page title>" [--site en.wikibooks.org] [--out dir]
 *   oer-import build <sourceDir> <outDir>
 *
 * Metadata flags (override front matter; required for CSV/TSV):
 *   --id --title --language --license --authors "A, B" --source <url>
 *   --description --version <n> --allow-nc
 *
 * `build` imports every .md/.csv/.tsv in sourceDir. A CSV/TSV deck takes its
 * metadata from a sidecar JSON file with the same name (deck.csv + deck.json).
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { importFile, importMediaWikiPage } from '../src/importer/index.js';

const META_KEYS = ['id', 'title', 'language', 'license', 'authors', 'source', 'description', 'version'];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: '.' },
    site: { type: 'string', default: 'en.wikibooks.org' },
    'user-agent': { type: 'string' },
    'allow-nc': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
    ...Object.fromEntries(META_KEYS.map((k) => [k, { type: 'string' }])),
  },
});

const USAGE = `Usage:
  oer-import file <path.md|.csv|.tsv> [--out dir] [--id --title --language --license --authors --source --description --version --allow-nc]
  oer-import wiki "<Page title>" [--site en.wikibooks.org] [--id] [--language] [--user-agent "..."] [--out dir]
  oer-import build <sourceDir> <outDir>`;

function usage(code = 0) {
  (code ? console.error : console.log)(USAGE);
  process.exit(code);
}

async function write(outDir, result) {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, `${result.module.id}.json`);
  await writeFile(path, JSON.stringify(result.module, null, 2) + '\n');
  for (const w of result.warnings) console.error(`warning: ${w}`);
  const counts = result.module.items.reduce((m, it) => ((m[it.type] = (m[it.type] ?? 0) + 1), m), {});
  console.log(`wrote ${path} (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')})`);
}

async function readSidecar(path) {
  const sidecar = path.slice(0, -extname(path).length) + '.json';
  try {
    return JSON.parse(await readFile(sidecar, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error(`${sidecar}: ${e.message}`);
  }
}

async function main() {
  const [cmd, ...args] = positionals;
  if (values.help || !cmd) usage(cmd ? 0 : 1);
  const meta = Object.fromEntries(META_KEYS.filter((k) => values[k] !== undefined).map((k) => [k, values[k]]));
  const allowNonCommercial = values['allow-nc'];

  if (cmd === 'file') {
    if (!args[0]) usage(1);
    const sidecar = /\.(csv|tsv)$/i.test(args[0]) ? await readSidecar(args[0]) : {};
    await write(values.out, await importFile(args[0], { meta: { ...sidecar, ...meta }, allowNonCommercial }));
  } else if (cmd === 'wiki') {
    if (!args[0]) usage(1);
    const result = await importMediaWikiPage({
      title: args[0],
      site: values.site,
      id: meta.id,
      language: meta.language,
      allowNonCommercial,
      ...(values['user-agent'] ? { userAgent: values['user-agent'] } : {}),
    });
    await write(values.out, result);
  } else if (cmd === 'build') {
    const [src, out] = args;
    if (!src || !out) usage(1);
    const files = (await readdir(src)).filter((f) => /\.(md|markdown|csv|tsv)$/i.test(f)).sort();
    let failed = 0;
    for (const f of files) {
      const path = join(src, f);
      try {
        const sidecar = /\.(csv|tsv)$/i.test(f) ? await readSidecar(path) : {};
        await write(out, await importFile(path, { meta: sidecar, allowNonCommercial: sidecar.allowNonCommercial === true }));
      } catch (e) {
        failed++;
        console.error(`error: ${basename(path)}: ${e.message}`);
      }
    }
    if (failed) process.exit(1);
  } else {
    usage(1);
  }
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
