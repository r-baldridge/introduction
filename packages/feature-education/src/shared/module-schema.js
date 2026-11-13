/**
 * Learning-module format shared by the importer, server, and PWA.
 * Browser-safe; no dependencies.
 *
 * {
 *   id: "fractions-basics",          // slug, stable across versions
 *   version: 1,                       // bump when content changes
 *   title, description?, language,    // language = BCP 47 tag, e.g. "en", "es-MX"
 *   license: { id: "CC-BY-4.0", url },
 *   attribution: { title, authors: [], sourceUrl?, historyUrl?, retrievedAt?, modifications? },
 *   items: [
 *     { id, type: "text", title?, body },
 *     { id, type: "flashcard", front, back },
 *     { id, type: "quiz", question, choices: [..], answer: <index>, explanation? }
 *   ]
 * }
 *
 * Flashcards and quizzes are "reviewable": each becomes a spaced-repetition
 * card with id `${module.id}/${item.id}`.
 */

export const REVIEWABLE_TYPES = new Set(['flashcard', 'quiz']);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LANG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const MAX_TEXT = 20000;

export function slugify(text, fallback = 'item') {
  const s = String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return s || fallback;
}

/** FNV-1a 32-bit hash -> 8 hex chars. Used for stable item ids. */
export function shortHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function cardId(moduleId, itemId) {
  return `${moduleId}/${itemId}`;
}

export function reviewableCardIds(mod) {
  return mod.items.filter((it) => REVIEWABLE_TYPES.has(it.type)).map((it) => cardId(mod.id, it.id));
}

function str(v, max = MAX_TEXT) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/**
 * Validate a module. Returns a list of human-readable problems ([] = valid).
 * Content is treated as untrusted: the PWA renders it as text, never as HTML,
 * but the validator still bounds sizes and shapes.
 */
export function validateModule(mod) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!mod || typeof mod !== 'object') return ['module must be an object'];

  if (!SLUG_RE.test(mod.id ?? '')) err('id must be a lowercase slug (a-z, 0-9, -)');
  if (!Number.isInteger(mod.version) || mod.version < 1) err('version must be a positive integer');
  if (!str(mod.title, 200)) err('title is required (≤200 chars)');
  if (mod.description !== undefined && !str(mod.description, 1000)) err('description must be ≤1000 chars');
  if (!LANG_RE.test(mod.language ?? '')) err('language must be a BCP 47 tag like "en" or "es-MX"');

  if (!mod.license || !str(mod.license.id, 64)) err('license.id is required (SPDX identifier)');
  if (mod.license && mod.license.url !== undefined && !/^https?:\/\//.test(mod.license.url)) {
    err('license.url must be an http(s) URL');
  }

  const a = mod.attribution;
  if (!a || !str(a.title, 300)) err('attribution.title is required');
  if (!a || !Array.isArray(a.authors) || a.authors.length === 0 || !a.authors.every((x) => str(x, 300))) {
    err('attribution.authors must be a non-empty list of names');
  }
  for (const k of ['sourceUrl', 'historyUrl']) {
    if (a && a[k] !== undefined && !/^https?:\/\//.test(a[k])) err(`attribution.${k} must be an http(s) URL`);
  }

  if (!Array.isArray(mod.items) || mod.items.length === 0) {
    err('items must be a non-empty list');
    return errors;
  }
  if (mod.items.length > 2000) err('too many items (max 2000)');

  const ids = new Set();
  mod.items.forEach((it, i) => {
    const at = `items[${i}]`;
    if (!it || typeof it !== 'object') return err(`${at} must be an object`);
    if (!ITEM_ID_RE.test(it.id ?? '')) err(`${at}.id must be a lowercase slug`);
    else if (ids.has(it.id)) err(`${at}.id "${it.id}" is duplicated`);
    ids.add(it.id);

    switch (it.type) {
      case 'text':
        if (!str(it.body)) err(`${at}.body is required`);
        if (it.title !== undefined && !str(it.title, 300)) err(`${at}.title must be ≤300 chars`);
        break;
      case 'flashcard':
        if (!str(it.front, 2000)) err(`${at}.front is required`);
        if (!str(it.back, 2000)) err(`${at}.back is required`);
        break;
      case 'quiz':
        if (!str(it.question, 2000)) err(`${at}.question is required`);
        if (!Array.isArray(it.choices) || it.choices.length < 2 || it.choices.length > 10 || !it.choices.every((c) => str(c, 500))) {
          err(`${at}.choices must be 2–10 non-empty strings`);
        } else if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.choices.length) {
          err(`${at}.answer must be the index of the correct choice`);
        }
        if (it.explanation !== undefined && !str(it.explanation, 2000)) err(`${at}.explanation must be ≤2000 chars`);
        break;
      default:
        err(`${at}.type must be text, flashcard, or quiz`);
    }
  });
  return errors;
}

/**
 * TASL attribution line (Title, Author, Source, License) — the format
 * Creative Commons recommends. Plain text; callers render it as text.
 */
export function attributionText(mod) {
  const a = mod.attribution;
  const parts = [`"${a.title}" by ${a.authors.join(', ')}`];
  if (a.sourceUrl) parts.push(`source: ${a.sourceUrl}`);
  parts.push(`licensed under ${mod.license.id}${mod.license.url ? ` (${mod.license.url})` : ''}`);
  if (a.modifications) parts.push(a.modifications);
  return parts.join(', ') + '.';
}
