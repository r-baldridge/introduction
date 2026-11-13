/**
 * Two-way sync with the server.
 *
 * Push: reviews in the outbox. Pull: modules changed since our cursor, and
 * this learner's reviews from other devices. Reviews are an append-only log
 * keyed by eventId, so sync is idempotent and order-independent: a request
 * that fails half-way can simply be retried.
 */

const BATCH = 500;

export async function syncNow({ store, learnerId, deviceId, fetchImpl = fetch }) {
  const stats = { pushed: 0, modules: 0, events: 0 };
  let cursor = await store.getMeta('cursor', { modules: 0, events: 0 });
  let outbox = await store.getAll('outbox');

  for (let round = 0; round < 50; round++) {
    const batch = outbox.slice(0, BATCH);
    const res = await fetchImpl('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId, deviceId, cursor, events: batch }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error ?? `sync failed (${res.status})`);
    }
    const data = await res.json();
    if (data.modules.length) await store.putMany('modules', data.modules);
    if (data.events.length) await store.putMany('events', data.events);
    // Whether new or already known, the server has these now.
    if (batch.length) await store.deleteMany('outbox', batch.map((e) => e.eventId));
    cursor = data.cursor;
    await store.setMeta('cursor', cursor);

    stats.pushed += batch.length;
    stats.modules += data.modules.length;
    stats.events += data.events.length;
    outbox = outbox.slice(BATCH);
    if (!data.more && outbox.length === 0) break;
  }
  await store.setMeta('lastSync', Date.now());
  return stats;
}
