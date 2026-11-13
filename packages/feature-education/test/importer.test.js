import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  importMarkdown, parseFrontMatter, importDelimited, parseDelimited, importMediaWikiPage,
  extractToItems, checkLicense, licenseIdFromUrl, LicenseError, ImportError,
} from '../src/importer/index.js';

const MD = `---
id: demo
title: Demo: Lesson
language: en
license: CC-BY-4.0
authors: Ada, Grace
source: https://example.org/demo
---
Intro paragraph without a heading.

## Part one
Some text.

Q: What is 2+2?
A: 4

? Pick the vowel
- [ ] b
- [x] a
> Vowels are a, e, i, o, u.

## Part two
More text.
`;

test('front matter keeps colons inside values', () => {
  assert.equal(parseFrontMatter(MD).meta.title, 'Demo: Lesson');
});

test('markdown → module with sections, flashcards, quizzes, and attribution', () => {
  const { module: m, warnings } = importMarkdown(MD);
  assert.deepEqual(warnings, []);
  assert.deepEqual(m.items.map((i) => i.type), ['text', 'text', 'flashcard', 'quiz', 'text']);
  assert.deepEqual(m.items.map((i) => i.title ?? null), [null, 'Part one', null, null, 'Part two']);
  const quiz = m.items[3];
  assert.deepEqual(quiz.choices, ['b', 'a']);
  assert.equal(quiz.answer, 1);
  assert.equal(quiz.explanation, 'Vowels are a, e, i, o, u.');
  assert.deepEqual(m.attribution.authors, ['Ada', 'Grace']);
  assert.equal(m.license.url, 'https://creativecommons.org/licenses/by/4.0/');
  assert.match(m.attribution.modifications, /Adapted/);
});

test('item ids are stable across edits to other content', () => {
  const a = importMarkdown(MD).module;
  const b = importMarkdown(MD.replace('Some text.', 'Rewritten text.').replace('More text.', 'Changed.')).module;
  const card = (m) => m.items.find((i) => i.type === 'flashcard').id;
  assert.equal(card(a), card(b));
});

test('markdown errors are explicit', () => {
  assert.throws(() => importMarkdown(MD.replace('A: 4', 'oops')), ImportError);
  assert.throws(() => importMarkdown(MD.replace('- [x] a', '- [ ] a')), /exactly one \[x\]/);
  assert.throws(() => importMarkdown(MD.replace('language: en', 'language: ???')), /language/);
});

test('license policy: refuses ND, unknown, and NC unless allowed', () => {
  assert.throws(() => checkLicense('CC-BY-ND-4.0'), LicenseError);
  assert.throws(() => checkLicense('All-Rights-Reserved'), LicenseError);
  assert.throws(() => checkLicense('CC-BY-NC-4.0'), /NonCommercial/);
  assert.match(checkLicense('CC-BY-NC-4.0', { allowNonCommercial: true }).warnings[0], /NonCommercial/);
  assert.match(checkLicense('CC-BY-SA-4.0').warnings[0], /ShareAlike/);
  assert.throws(() => importMarkdown(MD.replace('CC-BY-4.0', 'CC-BY-NC-ND-4.0')), LicenseError);
});

test('license URLs map to SPDX ids', () => {
  assert.equal(licenseIdFromUrl('https://creativecommons.org/licenses/by-sa/4.0/'), 'CC-BY-SA-4.0');
  assert.equal(licenseIdFromUrl('http://creativecommons.org/licenses/by-sa/3.0/'), 'CC-BY-SA-3.0');
  assert.equal(licenseIdFromUrl('https://creativecommons.org/licenses/by/4.0/legalcode'), 'CC-BY-4.0');
  assert.equal(licenseIdFromUrl('https://creativecommons.org/licenses/by/4.0/deed.es'), 'CC-BY-4.0');
  assert.equal(licenseIdFromUrl('https://example.org/license'), null);
});

test('CSV parser handles quotes, escaped quotes, newlines, BOM, CRLF', () => {
  const rows = parseDelimited('﻿front,back\r\n"a, b","say ""hi"""\r\n"multi\nline",x\r\n\r\n');
  assert.deepEqual(rows, [['front', 'back'], ['a, b', 'say "hi"'], ['multi\nline', 'x']]);
  assert.throws(() => parseDelimited('a,"b'), ImportError);
});

test('CSV/TSV → flashcard module', () => {
  const meta = { id: 'deck', title: 'Deck', language: 'es', license: 'CC0-1.0', authors: 'Someone' };
  const { module: m } = importDelimited('Term\tDefinition\textra\nhola\thello\tx\n', { meta, delimiter: '\t' });
  assert.deepEqual(m.items.map(({ front, back }) => [front, back]), [['hola', 'hello']]);
  assert.throws(() => importDelimited('a,b\n1,2\n', { meta }), /header must include/);
  assert.throws(() => importDelimited('front,back\nhola,\n', { meta }), /Row 2/);
});

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[key] };
  };
  fn.calls = calls;
  return fn;
}

test('MediaWiki extract splits on headings and drops empty sections', () => {
  const items = extractToItems('Lead.\n== A ==\nBody A\n=== A.1 ===\nBody A1\n== Empty ==\n\n', 'Page');
  assert.deepEqual(items.map((i) => [i.title, i.body]), [['Page', 'Lead.'], ['A', 'Body A'], ['A.1', 'Body A1']]);
});

test('Wikibooks import reads the license from the wiki and links the exact revision', async () => {
  const fixture = async (f) => JSON.parse(await readFile(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
  const fetch = fakeFetch({ 'meta=siteinfo': await fixture('wikibooks-siteinfo.json'), 'prop=extracts': await fixture('wikibooks-page.json') });
  const { module: m, warnings } = await importMediaWikiPage({ title: 'Example Book/Seeds', fetch, now: Date.UTC(2026, 10, 13) });

  assert.equal(m.id, 'example-book-seeds');
  assert.equal(m.language, 'en');
  assert.equal(m.license.id, 'CC-BY-SA-4.0');
  assert.match(warnings[0], /ShareAlike/);
  assert.deepEqual(m.attribution.authors, ['Wikibooks contributors']);
  assert.equal(m.attribution.sourceUrl, 'https://en.wikibooks.org/w/index.php?title=Example_Book%2FSeeds&oldid=987654');
  assert.equal(m.attribution.historyUrl, 'https://en.wikibooks.org/wiki/Example_Book/Seeds?action=history');
  assert.equal(m.attribution.retrievedAt, '2026-11-13T00:00:00.000Z');
  assert.deepEqual(m.items.map((i) => i.title), ['Example Book/Seeds', 'Germination', 'Water']);
  assert.match(fetch.calls[0].init.headers['User-Agent'], /uplifting-oer-importer/);
  assert.match(fetch.calls[1].url, /titles=Example%20Book%2FSeeds/);
});

test('Wikibooks import refuses unknown site licenses and missing pages', async () => {
  const badLicense = fakeFetch({ 'meta=siteinfo': { query: { rightsinfo: { url: 'https://example.org/proprietary', text: 'Proprietary' } } } });
  await assert.rejects(importMediaWikiPage({ title: 'X', fetch: badLicense }), LicenseError);

  const missing = fakeFetch({
    'meta=siteinfo': { query: { rightsinfo: { url: 'https://creativecommons.org/licenses/by-sa/4.0/' } } },
    'prop=extracts': { query: { pages: [{ title: 'Nope', missing: true }] } },
  });
  await assert.rejects(importMediaWikiPage({ title: 'Nope', fetch: missing }), /not found/);
  await assert.rejects(importMediaWikiPage({ title: 'X', site: 'evil.com/../', fetch: missing }), /Invalid site/);
});
