import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, GRADES, newCardState, review, replay, buildSession, previewIntervals, isDue, nextDue } from '../src/shared/srs.js';

const T0 = Date.UTC(2026, 0, 1);

test('SM-2 interval progression: 1, 6, then interval × easiness', () => {
  let s = newCardState('m/a');
  s = review(s, GRADES.good, T0);
  assert.equal(s.intervalDays, 1);
  assert.equal(s.easiness, 2.5);
  s = review(s, GRADES.good, T0 + DAY_MS);
  assert.equal(s.intervalDays, 6);
  s = review(s, GRADES.good, T0 + 7 * DAY_MS);
  assert.equal(s.intervalDays, 15);
  assert.equal(s.due, T0 + 7 * DAY_MS + 15 * DAY_MS);
  assert.equal(s.repetitions, 3);
});

test('easy raises easiness; failing resets repetitions and counts a lapse', () => {
  let s = review(newCardState('m/a'), GRADES.easy, T0);
  assert.equal(s.easiness, 2.6);
  assert.equal(s.lapses, 0);
  s = review(s, GRADES.again, T0 + DAY_MS);
  assert.equal(s.repetitions, 0);
  assert.equal(s.intervalDays, 1);
  assert.equal(s.lapses, 1);
  assert.equal(s.easiness, 2.06);
});

test('failing a brand-new card is not a lapse', () => {
  assert.equal(review(newCardState('m/a'), GRADES.again, T0).lapses, 0);
});

test('easiness never drops below 1.3', () => {
  let s = newCardState('m/a');
  for (let i = 0; i < 20; i++) s = review(s, 0, T0 + i * DAY_MS);
  assert.equal(s.easiness, 1.3);
});

test('review does not mutate its input and rejects bad grades', () => {
  const s = newCardState('m/a');
  review(s, 4, T0);
  assert.deepEqual(s, newCardState('m/a'));
  assert.throws(() => review(s, 6, T0), RangeError);
  assert.throws(() => review(s, 2.5, T0), RangeError);
  assert.throws(() => review(s, 4, NaN), TypeError);
});

test('replay is order-independent and deduplicates events', () => {
  const evs = [
    { eventId: 'e1', cardId: 'm/a', grade: 4, reviewedAt: T0 },
    { eventId: 'e2', cardId: 'm/a', grade: 4, reviewedAt: T0 + DAY_MS },
    { eventId: 'e3', cardId: 'm/b', grade: 1, reviewedAt: T0 },
  ];
  const a = replay(evs);
  const b = replay([evs[2], evs[1], evs[0], evs[1]]); // shuffled + duplicate
  assert.deepEqual([...a.entries()], [...b.entries()].sort(([x], [y]) => (x < y ? -1 : 1)));
  assert.equal(a.get('m/a').intervalDays, 6);
  assert.equal(a.get('m/a').reviews, 2);
});

test('replay skips malformed events instead of failing', () => {
  const s = replay([
    { eventId: 'e1', cardId: 'm/a', grade: 9, reviewedAt: T0 },
    { eventId: 'e2', cardId: 'm/a', grade: 4, reviewedAt: T0 },
  ]);
  assert.equal(s.get('m/a').reviews, 1);
});

test('buildSession: overdue first, then new cards in course order, with limits', () => {
  const states = replay([
    { eventId: 'e1', cardId: 'm/a', grade: 4, reviewedAt: T0 }, // due T0+1d
    { eventId: 'e2', cardId: 'm/b', grade: 4, reviewedAt: T0 - DAY_MS }, // due T0 (more overdue)
    { eventId: 'e3', cardId: 'm/c', grade: 5, reviewedAt: T0 + 5 * DAY_MS }, // not due
  ]);
  const ids = ['m/a', 'm/b', 'm/c', 'm/d', 'm/e', 'm/f'];
  const s = buildSession(ids, states, { now: T0 + 2 * DAY_MS, maxNew: 2 });
  assert.deepEqual(s.reviews, ['m/b', 'm/a']);
  assert.deepEqual(s.new, ['m/d', 'm/e']);
  assert.equal(s.dueCount, 2);
  assert.equal(s.newCount, 3);
});

test('previewIntervals, isDue, nextDue', () => {
  const s = review(newCardState('m/a'), 4, T0);
  assert.deepEqual(previewIntervals(s, T0 + DAY_MS), { again: 1, hard: 6, good: 6, easy: 6 });
  assert.equal(isDue(s, T0), false);
  assert.equal(isDue(s, T0 + DAY_MS), true);
  assert.equal(isDue(newCardState('x/y'), T0), false);
  assert.equal(nextDue(new Map([['m/a', s]])), T0 + DAY_MS);
  assert.equal(nextDue(new Map()), null);
});
