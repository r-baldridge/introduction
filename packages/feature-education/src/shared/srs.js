/**
 * Spaced-repetition engine (SM-2).
 *
 * Pure, dependency-free, and browser-safe: the same file runs in Node (server,
 * tests) and in the PWA, so a learner's schedule is computed identically on
 * every device.
 *
 * Design: the source of truth is an append-only *review log*. Card state is
 * never synced directly — it is derived by replaying the log. Merging two
 * devices' progress is therefore just "union the logs, replay", which cannot
 * conflict.
 *
 * Algorithm reference: P. A. Wozniak, "SuperMemo 2" (1987),
 * https://super-memory.com/english/ol/sm2.htm
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Button labels shown to learners, mapped onto SM-2's 0–5 quality scale. */
export const GRADES = Object.freeze({ again: 1, hard: 3, good: 4, easy: 5 });

const MIN_EASINESS = 1.3;
const START_EASINESS = 2.5;

/** A card the learner has not reviewed yet. */
export function newCardState(cardId) {
  return {
    cardId,
    repetitions: 0,
    easiness: START_EASINESS,
    intervalDays: 0,
    due: null, // null = new, never reviewed
    lapses: 0,
    reviews: 0,
    lastReviewed: null,
  };
}

function assertGrade(grade) {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new RangeError(`grade must be an integer 0–5, got ${grade}`);
  }
}

/**
 * Apply one review to a card state. Returns a new state (input is not mutated).
 * @param {object} state  from newCardState() or a previous review()
 * @param {number} grade  0–5 (see GRADES)
 * @param {number} reviewedAt  epoch ms
 */
export function review(state, grade, reviewedAt) {
  assertGrade(grade);
  if (!Number.isFinite(reviewedAt)) throw new TypeError('reviewedAt must be epoch ms');

  let { repetitions, easiness, intervalDays, lapses } = state;

  if (grade >= 3) {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easiness);
    repetitions += 1;
  } else {
    // Forgotten: relearn from the start, but keep the easiness history.
    if (state.reviews > 0) lapses += 1;
    repetitions = 0;
    intervalDays = 1;
  }

  const q = 5 - grade;
  easiness = Math.max(MIN_EASINESS, easiness + (0.1 - q * (0.08 + q * 0.02)));

  return {
    cardId: state.cardId,
    repetitions,
    easiness: Math.round(easiness * 1000) / 1000,
    intervalDays,
    due: reviewedAt + intervalDays * DAY_MS,
    lapses,
    reviews: state.reviews + 1,
    lastReviewed: reviewedAt,
  };
}

/**
 * What interval each button would produce — shown on the buttons so the
 * scheduling is transparent rather than a black box.
 * @returns {{again:number, hard:number, good:number, easy:number}} days
 */
export function previewIntervals(state, now) {
  const out = {};
  for (const [name, grade] of Object.entries(GRADES)) {
    out[name] = review(state, grade, now).intervalDays;
  }
  return out;
}

/** Deterministic ordering for log replay. */
function compareEvents(a, b) {
  return a.reviewedAt - b.reviewedAt || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0);
}

/**
 * Rebuild every card's state from a review log.
 * Duplicate eventIds (e.g. the same event received from two devices) are
 * counted once. Events with invalid grades are skipped, not thrown, so one bad
 * record can't brick a learner's whole schedule.
 * @param {Array<{eventId:string, cardId:string, grade:number, reviewedAt:number}>} events
 * @returns {Map<string, object>} cardId -> state
 */
export function replay(events) {
  const seen = new Set();
  const states = new Map();
  for (const ev of [...events].sort(compareEvents)) {
    if (seen.has(ev.eventId)) continue;
    seen.add(ev.eventId);
    const prev = states.get(ev.cardId) ?? newCardState(ev.cardId);
    try {
      states.set(ev.cardId, review(prev, ev.grade, ev.reviewedAt));
    } catch {
      /* skip malformed event */
    }
  }
  return states;
}

export function isDue(state, now) {
  return state.due !== null && state.due <= now;
}

/**
 * Pick the cards for a study session.
 * Due reviews come first (most overdue first), then new cards in course order.
 * @param {string[]} cardIds  all enrolled cards, in course order
 * @param {Map<string, object>} states  from replay()
 * @param {{now:number, maxNew?:number, maxReviews?:number}} opts
 */
export function buildSession(cardIds, states, { now, maxNew = 10, maxReviews = 100 } = {}) {
  const due = [];
  const fresh = [];
  for (const id of cardIds) {
    const s = states.get(id);
    if (!s || s.due === null) fresh.push(id);
    else if (s.due <= now) due.push(s);
  }
  due.sort((a, b) => a.due - b.due);
  return {
    reviews: due.slice(0, maxReviews).map((s) => s.cardId),
    new: fresh.slice(0, maxNew),
    dueCount: due.length,
    newCount: fresh.length,
  };
}

/** Earliest upcoming due time among reviewed cards, or null. */
export function nextDue(states) {
  let min = null;
  for (const s of states.values()) {
    if (s.due !== null && (min === null || s.due < min)) min = s.due;
  }
  return min;
}
