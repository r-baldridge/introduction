/**
 * Import a flashcard deck from CSV or TSV (the format most flashcard apps and
 * spreadsheets export). The first row is a header; recognised columns:
 *   front (or question, term)   — required
 *   back  (or answer, definition) — required
 * Other columns are ignored. Module metadata comes from the caller (CLI flags),
 * since CSV has nowhere to put it.
 */

import { shortHash } from '../shared/module-schema.js';
import { assembleModule, ImportError } from './markdown.js';

/** RFC 4180-style parser: quoted fields, "" escapes, newlines inside quotes. */
export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new ImportError('Unterminated quoted field in CSV.');
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const FRONT = ['front', 'question', 'term'];
const BACK = ['back', 'answer', 'definition'];

export function importDelimited(text, { meta, delimiter = ',', allowNonCommercial = false }) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length < 2) throw new ImportError('CSV needs a header row and at least one card.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const fi = header.findIndex((h) => FRONT.includes(h));
  const bi = header.findIndex((h) => BACK.includes(h));
  if (fi < 0 || bi < 0) {
    throw new ImportError(`CSV header must include a front column (${FRONT.join('/')}) and a back column (${BACK.join('/')}).`);
  }
  const used = new Set();
  const items = [];
  rows.slice(1).forEach((r, n) => {
    const front = (r[fi] ?? '').trim();
    const back = (r[bi] ?? '').trim();
    if (!front || !back) throw new ImportError(`Row ${n + 2}: both front and back are required.`);
    let id = `card-${shortHash(front)}`;
    for (let k = 2; used.has(id); k++) id = `card-${shortHash(front)}-${k}`;
    used.add(id);
    items.push({ id, type: 'flashcard', front, back });
  });
  return assembleModule({ meta, items, allowNonCommercial });
}
