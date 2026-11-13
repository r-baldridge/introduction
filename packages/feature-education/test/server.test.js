import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/server/db.js';
import { createApp, loadContentDir } from '../src/server/app.js';

let server, base, db;
const CONTENT = new URL('../content/modules/', import.meta.url).pathname;
const learnerId = 'learner-0000-aaaa';
const now = Date.now();

before(async () => {
  db = openDatabase(':memory:');
  await loadContentDir(db, CONTENT);
  server = createApp({ db });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(() => { db.close(); r(); })));

const sync = (body) =>
  fetch(`${base}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ev = (id, cardId = 'fractions-basics/x', grade = 4, reviewedAt = now) => ({ eventId: `evt-${id}-0000`, cardId, grade, reviewedAt });

test('health and module listing with cursor', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
  const all = await (await fetch(`${base}/api/modules`)).json();
  assert.deepEqual(all.modules.map((m) => m.id).sort(), ['fractions-basics', 'spanish-greetings']);
  const none = await (await fetch(`${base}/api/modules?since=${all.cursor}`)).json();
  assert.deepEqual(none.modules, []);
  assert.equal((await fetch(`${base}/api/modules?since=-1`)).status, 400);
});

test('reloading identical content is a no-op; changes need a version bump; never downgrades', async () => {
  assert.deepEqual(await loadContentDir(db, CONTENT), { unchanged: 2 });
  const m = db.modulesSince(0).modules.find((x) => x.id === 'spanish-greetings');
  assert.throws(() => db.putModule({ ...m, title: 'Changed' }), /version bump/);
  assert.equal(db.putModule({ ...m, version: m.version + 1, title: 'Changed' }), 'updated');
  assert.equal(db.putModule(m), 'older');
  assert.throws(() => db.putModule({ ...m, id: 'BAD ID' }), /invalid module/);
});

test('sync pushes reviews idempotently and returns them to other devices', async () => {
  const r1 = await (await sync({ learnerId, deviceId: 'device-aaaa', events: [ev(1), ev(2)] })).json();
  assert.equal(r1.accepted, 2);
  assert.equal(r1.modules.length, 2);
  assert.equal(r1.events.length, 2);

  // Same events again (e.g. a retried request) are not duplicated.
  const r2 = await (await sync({ learnerId, deviceId: 'device-aaaa', cursor: r1.cursor, events: [ev(1), ev(2)] })).json();
  assert.equal(r2.accepted, 0);
  assert.deepEqual(r2.events, []);
  assert.deepEqual(r2.modules, []);

  // A second device starting from zero gets the learner's full log...
  const r3 = await (await sync({ learnerId, deviceId: 'device-bbbb', events: [ev(3)] })).json();
  assert.deepEqual(r3.events.map((e) => e.eventId), ['evt-1-0000', 'evt-2-0000', 'evt-3-0000']);
  // ...and nobody else's.
  const other = await (await sync({ learnerId: 'someone-else-1234', events: [] })).json();
  assert.deepEqual(other.events, []);
});

test('sync validates input', async () => {
  const cases = [
    [{ learnerId: 'short', events: [] }, /learnerId/],
    [{ learnerId, events: [ev(9, 'no-slash')] }, /cardId/],
    [{ learnerId, events: [ev(9, 'a/b', 7)] }, /grade/],
    [{ learnerId, events: [ev(9, 'a/b', 4, now + 10 * 86400000)] }, /reviewedAt/],
    [{ learnerId, events: [{ ...ev(9), eventId: '../../x' }] }, /eventId/],
    [{ learnerId, cursor: { events: 'x' } }, /cursor.events/],
  ];
  for (const [body, msg] of cases) {
    const res = await sync(body);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, msg);
  }
  const notJson = await fetch(`${base}/api/sync`, { method: 'POST', body: 'x' });
  assert.equal(notJson.status, 415);
  const tooMany = await sync({ learnerId, events: Array.from({ length: 1001 }, (_, i) => ev(`m${i}`)) });
  assert.equal(tooMany.status, 413);
  assert.equal((await fetch(`${base}/api/sync`)).status, 405);
});

test('serves the PWA and shared engine with security headers, and blocks traversal', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
  const lib = await fetch(`${base}/lib/srs.js`);
  assert.match(await lib.text(), /export function review/);
  assert.equal((await fetch(`${base}/lib/..%2Fserver%2Fdb.js`)).status, 404);
  assert.equal((await fetch(`${base}/..%2F..%2Fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});
