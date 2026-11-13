/**
 * Micro-learning sync server. Zero dependencies: node:http + node:sqlite.
 *
 * Routes
 *   GET  /api/health
 *   GET  /api/modules?since=<seq>        modules changed after a cursor
 *   POST /api/sync                       push review events, pull changes
 *   GET  /lib/*                          browser copies of src/shared (engine, schema)
 *   GET  /*                              the PWA (public/)
 *
 * Identity: learners are identified by a random id generated on their device.
 * There are no accounts yet — this is pseudonymous by design until
 * core-agency provides identity. Anyone holding a learner id can read that
 * learner's review history, so treat it like a bearer token.
 */

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const PUBLIC_DIR = resolve(HERE, '../../public');
export const SHARED_DIR = resolve(HERE, '../shared');

const MAX_BODY = 1_000_000;
const MAX_EVENTS = 1000;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const CARD_RE = /^[a-z0-9-]{1,80}\/[a-z0-9-]{1,80}$/;
const EPOCH_2000 = Date.UTC(2000, 0, 1);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...(isJson ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}),
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function cursorParam(v, name) {
  const n = v === undefined || v === null || v === '' ? 0 : Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new HttpError(400, `${name} must be a non-negative integer`);
  return n;
}

/** Validate a sync request body; returns a normalised copy. Exported for tests. */
export function parseSyncBody(body, now = Date.now()) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Body must be an object');
  const { learnerId, deviceId, cursor = {}, events = [] } = body;
  if (!ID_RE.test(learnerId ?? '')) throw new HttpError(400, 'learnerId must be 8–64 URL-safe characters');
  if (deviceId !== undefined && !ID_RE.test(deviceId)) throw new HttpError(400, 'deviceId must be 8–64 URL-safe characters');
  if (!Array.isArray(events)) throw new HttpError(400, 'events must be a list');
  if (events.length > MAX_EVENTS) throw new HttpError(413, `At most ${MAX_EVENTS} events per sync`);
  const maxTime = now + 24 * 60 * 60 * 1000; // tolerate a day of clock skew
  const clean = events.map((e, i) => {
    const bad = (m) => new HttpError(400, `events[${i}]: ${m}`);
    if (!e || typeof e !== 'object') throw bad('must be an object');
    if (!ID_RE.test(e.eventId ?? '')) throw bad('eventId must be 8–64 URL-safe characters');
    if (!CARD_RE.test(e.cardId ?? '')) throw bad('cardId must look like "module-id/item-id"');
    if (!Number.isInteger(e.grade) || e.grade < 0 || e.grade > 5) throw bad('grade must be an integer 0–5');
    if (!Number.isSafeInteger(e.reviewedAt) || e.reviewedAt < EPOCH_2000 || e.reviewedAt > maxTime) {
      throw bad('reviewedAt must be a plausible epoch-ms timestamp');
    }
    return { eventId: e.eventId, cardId: e.cardId, grade: e.grade, reviewedAt: e.reviewedAt };
  });
  return {
    learnerId,
    deviceId,
    events: clean,
    cursor: { modules: cursorParam(cursor.modules, 'cursor.modules'), events: cursorParam(cursor.events, 'cursor.events') },
  };
}

async function serveStatic(res, root, relPath) {
  const target = normalize(join(root, relPath));
  if (target !== root && !target.startsWith(root + sep)) throw new HttpError(404, 'Not found');
  let file = target;
  const info = await stat(file).catch(() => null);
  if (info?.isDirectory()) file = join(file, 'index.html');
  const data = await readFile(file).catch(() => null);
  if (!data) throw new HttpError(404, 'Not found');
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  // The service worker must always be revalidated so app updates roll out.
  send(res, 200, data, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
}

/**
 * @param {{db: ReturnType<import('./db.js').openDatabase>, log?: Function}} opts
 */
export function createApp({ db, log = () => {} }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return send(res, 200, { ok: true });
      }
      if (url.pathname === '/api/modules' && req.method === 'GET') {
        return send(res, 200, db.modulesSince(cursorParam(url.searchParams.get('since'), 'since')));
      }
      if (url.pathname === '/api/sync') {
        if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
        const body = parseSyncBody(await readJson(req));
        const accepted = db.addReviews(body.learnerId, body.deviceId, body.events);
        const mods = db.modulesSince(body.cursor.modules);
        const revs = db.reviewsSince(body.learnerId, body.cursor.events);
        return send(res, 200, {
          accepted,
          modules: mods.modules,
          events: revs.events,
          more: revs.more,
          cursor: { modules: mods.cursor, events: revs.cursor },
        });
      }
      if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'Not found');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
      let path;
      try {
        path = decodeURIComponent(url.pathname);
      } catch {
        throw new HttpError(400, 'Malformed URL');
      }
      if (path.startsWith('/lib/')) return await serveStatic(res, SHARED_DIR, path.slice('/lib/'.length));
      return await serveStatic(res, PUBLIC_DIR, path.slice(1));
    } catch (err) {
      const status = err.status ?? 500;
      if (status === 500) log(`error: ${req.method} ${url.pathname}: ${err.stack ?? err}`);
      send(res, status, { error: status === 500 ? 'Internal server error' : err.message });
    }
  });
}

/** Load every *.json module in a directory into the database. */
export async function loadContentDir(db, dir, log = () => {}) {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
  const summary = {};
  for (const f of files) {
    try {
      const result = db.putModule(JSON.parse(await readFile(join(dir, f), 'utf8')));
      summary[result] = (summary[result] ?? 0) + 1;
    } catch (e) {
      log(`skipping ${f}: ${e.message}`);
      summary.failed = (summary.failed ?? 0) + 1;
    }
  }
  return summary;
}
