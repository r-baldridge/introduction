/**
 * Storage for the micro-learning sync server, using Node's built-in SQLite
 * (node:sqlite, Node ≥ 22.5) so there is no native module to compile.
 *
 * Tables
 *   modules  — current version of each learning module (JSON) + a change seq
 *   reviews  — append-only review log; seq doubles as the sync cursor
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateModule } from '../shared/module-schema.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS modules (
  id      TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  json    TEXT NOT NULL,
  seq     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS modules_seq ON modules(seq);

CREATE TABLE IF NOT EXISTS reviews (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT NOT NULL UNIQUE,
  learner_id  TEXT NOT NULL,
  card_id     TEXT NOT NULL,
  grade       INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 5),
  reviewed_at INTEGER NOT NULL,
  device_id   TEXT,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_learner_seq ON reviews(learner_id, seq);
`;

export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const q = {
    getModule: db.prepare('SELECT version, json FROM modules WHERE id = ?'),
    nextModuleSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM modules'),
    upsertModule: db.prepare(
      `INSERT INTO modules (id, version, json, seq) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version, json = excluded.json, seq = excluded.seq`,
    ),
    modulesSince: db.prepare('SELECT json, seq FROM modules WHERE seq > ? ORDER BY seq'),
    moduleCursor: db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM modules'),
    insertReview: db.prepare(
      `INSERT OR IGNORE INTO reviews (event_id, learner_id, card_id, grade, reviewed_at, device_id, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    reviewsSince: db.prepare(
      `SELECT seq, event_id, card_id, grade, reviewed_at, device_id FROM reviews
       WHERE learner_id = ? AND seq > ? ORDER BY seq LIMIT ?`,
    ),
  };

  return {
    raw: db,
    close: () => db.close(),

    /**
     * Insert or update a module. Never downgrades; identical content is a
     * no-op (so restarting the server doesn't make every client re-download).
     * @returns {'inserted'|'updated'|'unchanged'|'older'}
     */
    putModule(mod) {
      const errors = validateModule(mod);
      if (errors.length) throw new Error(`invalid module ${mod?.id}: ${errors.join('; ')}`);
      const json = JSON.stringify(mod);
      const existing = q.getModule.get(mod.id);
      if (existing) {
        if (existing.json === json) return 'unchanged';
        if (mod.version < existing.version) return 'older';
        if (mod.version === existing.version) {
          throw new Error(`module ${mod.id} v${mod.version} changed without a version bump`);
        }
      }
      q.upsertModule.run(mod.id, mod.version, json, q.nextModuleSeq.get().seq);
      return existing ? 'updated' : 'inserted';
    },

    modulesSince(seq) {
      const rows = q.modulesSince.all(seq);
      return { modules: rows.map((r) => JSON.parse(r.json)), cursor: rows.length ? rows.at(-1).seq : seq };
    },

    moduleCursor: () => q.moduleCursor.get().seq,

    /** @returns {number} how many events were new */
    addReviews(learnerId, deviceId, events, now = Date.now()) {
      let added = 0;
      db.exec('BEGIN');
      try {
        for (const e of events) {
          added += Number(q.insertReview.run(e.eventId, learnerId, e.cardId, e.grade, e.reviewedAt, deviceId ?? null, now).changes);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return added;
    },

    reviewsSince(learnerId, seq, limit = 5000) {
      const rows = q.reviewsSince.all(learnerId, seq, limit + 1);
      const more = rows.length > limit;
      const page = rows.slice(0, limit);
      return {
        events: page.map((r) => ({ eventId: r.event_id, cardId: r.card_id, grade: r.grade, reviewedAt: r.reviewed_at, deviceId: r.device_id })),
        cursor: page.length ? page.at(-1).seq : seq,
        more,
      };
    },
  };
}
