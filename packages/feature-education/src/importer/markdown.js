/**
 * Import a Markdown lesson into a learning module.
 *
 * Format:
 *
 *   ---
 *   id: fractions-basics
 *   title: Fractions: The Basics
 *   language: en
 *   license: CC-BY-4.0
 *   authors: Ada Example, Grace Example
 *   source: https://example.org/original      (optional)
 *   description: One-line summary              (optional)
 *   version: 1                                 (optional, default 1)
 *   ---
 *
 *   ## A heading starts a text section
 *   Paragraphs belong to the section above them.
 *
 *   Q: Flashcard front
 *   A: Flashcard back
 *
 *   ? Quiz question
 *   - [ ] wrong choice
 *   - [x] correct choice
 *   > Optional explanation
 *
 * Item ids are derived from content (heading slug, or a hash of the question),
 * so re-importing an edited file keeps learners' progress on unchanged items.
 */

import { slugify, shortHash, validateModule } from '../shared/module-schema.js';
import { checkLicense, MODIFICATION_NOTE } from './licenses.js';

export class ImportError extends Error {}

export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

function uniqueId(base, used) {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** Parse the body into items (no metadata). Exported for reuse by other importers. */
export function parseItems(body) {
  const items = [];
  const used = new Set();
  const lines = body.split(/\r?\n/);
  let text = null; // current text section being collected
  let quiz = null;

  const flushText = () => {
    if (text && text.lines.join('\n').trim()) {
      const bodyText = text.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      const base = text.title ? slugify(text.title, 'section') : `section-${shortHash(bodyText)}`;
      items.push({ id: uniqueId(base, used), type: 'text', ...(text.title ? { title: text.title } : {}), body: bodyText });
    }
    text = null;
  };
  const flushQuiz = () => {
    if (!quiz) return;
    const answers = quiz.correct.length;
    if (quiz.choices.length < 2 || answers !== 1) {
      throw new ImportError(`Quiz "${quiz.question}" needs at least 2 choices and exactly one [x] answer (has ${answers}).`);
    }
    items.push({
      id: uniqueId(`quiz-${shortHash(quiz.question)}`, used),
      type: 'quiz',
      question: quiz.question,
      choices: quiz.choices,
      answer: quiz.correct[0],
      ...(quiz.explanation.length ? { explanation: quiz.explanation.join(' ') } : {}),
    });
    quiz = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    const q = /^Q:\s*(.+)$/.exec(line);
    const quizStart = /^\?\s+(.+)$/.exec(line);

    if (quiz) {
      const choice = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(line);
      const expl = /^>\s?(.*)$/.exec(line);
      if (choice) {
        if (choice[1].toLowerCase() === 'x') quiz.correct.push(quiz.choices.length);
        quiz.choices.push(choice[2].trim());
        continue;
      }
      if (expl) {
        quiz.explanation.push(expl[1].trim());
        continue;
      }
      flushQuiz();
    }

    if (heading) {
      flushText();
      text = { title: heading[1], lines: [] };
    } else if (q) {
      flushText();
      const a = /^A:\s*(.+)$/.exec(lines[i + 1] ?? '');
      if (!a) throw new ImportError(`Line ${i + 1}: "Q:" must be followed by an "A:" line.`);
      i++;
      const front = q[1].trim();
      items.push({ id: uniqueId(`card-${shortHash(front)}`, used), type: 'flashcard', front, back: a[1].trim() });
    } else if (quizStart) {
      flushText();
      quiz = { question: quizStart[1].trim(), choices: [], correct: [], explanation: [] };
    } else {
      if (!text) {
        if (!line.trim()) continue;
        text = { title: null, lines: [] };
      }
      text.lines.push(line);
    }
  }
  flushQuiz();
  flushText();
  return items;
}

/**
 * Build a validated module from metadata + items. Shared by all importers.
 * Throws ImportError (or LicenseError) with every problem listed.
 */
export function assembleModule({ meta, items, allowNonCommercial = false, retrievedAt }) {
  const license = checkLicense(meta.license, { allowNonCommercial });
  const authors = Array.isArray(meta.authors)
    ? meta.authors
    : String(meta.authors ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const mod = {
    id: meta.id || slugify(meta.title ?? '', 'module'),
    version: meta.version ? Number(meta.version) : 1,
    title: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
    language: meta.language,
    license: { id: license.id, url: license.url },
    attribution: {
      title: meta.sourceTitle || meta.title,
      authors,
      ...(meta.source ? { sourceUrl: meta.source } : {}),
      ...(meta.history ? { historyUrl: meta.history } : {}),
      ...(retrievedAt ? { retrievedAt } : {}),
      ...(meta.original === 'true' ? {} : { modifications: MODIFICATION_NOTE }),
    },
    items,
  };
  const errors = validateModule(mod);
  if (errors.length) throw new ImportError(`Imported module is invalid:\n  - ${errors.join('\n  - ')}`);
  return { module: mod, warnings: license.warnings };
}

/**
 * @param {string} text  Markdown source
 * @param {object} [overrides]  metadata that wins over front matter (e.g. from CLI flags)
 */
export function importMarkdown(text, { overrides = {}, allowNonCommercial = false } = {}) {
  const { meta, body } = parseFrontMatter(text);
  return assembleModule({ meta: { ...meta, ...overrides }, items: parseItems(body), allowNonCommercial });
}
