import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { validateModule, slugify, shortHash, reviewableCardIds, attributionText } from '../src/shared/module-schema.js';

const valid = () => ({
  id: 'demo',
  version: 1,
  title: 'Demo',
  language: 'en',
  license: { id: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  attribution: { title: 'Demo source', authors: ['A. Author'], sourceUrl: 'https://example.org/demo' },
  items: [
    { id: 'intro', type: 'text', body: 'Hello' },
    { id: 'c1', type: 'flashcard', front: 'Q', back: 'A' },
    { id: 'q1', type: 'quiz', question: 'Pick', choices: ['x', 'y'], answer: 1 },
  ],
});

test('a well-formed module validates', () => {
  assert.deepEqual(validateModule(valid()), []);
});

test('validation catches common mistakes', () => {
  const m = valid();
  m.id = 'Not A Slug';
  m.items[1].back = '';
  m.items[2].answer = 5;
  m.items.push({ id: 'intro', type: 'video', body: 'x' });
  m.attribution.sourceUrl = 'javascript:alert(1)';
  const errs = validateModule(m).join('\n');
  for (const s of ['id must be', 'items[1].back', 'items[2].answer', 'duplicated', 'items[3].type', 'sourceUrl']) {
    assert.match(errs, new RegExp(s.replace(/[[\]]/g, '\\$&')));
  }
});

test('helpers', () => {
  assert.equal(slugify('Fractions: The Basics!'), 'fractions-the-basics');
  assert.equal(slugify('¿Cómo estás?'), 'como-estas');
  assert.equal(slugify('!!!', 'x'), 'x');
  assert.equal(shortHash('hola'), shortHash('hola'));
  assert.notEqual(shortHash('hola'), shortHash('hola '));
  assert.deepEqual(reviewableCardIds(valid()), ['demo/c1', 'demo/q1']);
  assert.equal(attributionText(valid()), '"Demo source" by A. Author, source: https://example.org/demo, licensed under CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).');
});

test('bundled content modules are valid', async () => {
  const dir = new URL('../content/modules/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 2);
  for (const f of files) {
    assert.deepEqual(validateModule(JSON.parse(await readFile(new URL(f, dir), 'utf8'))), [], f);
  }
});
