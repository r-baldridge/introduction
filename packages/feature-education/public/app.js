import { GRADES, buildSession, nextDue, previewIntervals, replay, newCardState, review } from '/lib/srs.js';
import { attributionText, cardId, reviewableCardIds } from '/lib/module-schema.js';
import { openStore } from './store.js';
import { syncNow } from './sync.js';
import { h, renderBody, safeLink, formatDays, formatWhen } from './render.js';

const view = document.getElementById('view');
const statusEl = document.getElementById('status');

const state = {
  store: null,
  learnerId: null,
  deviceId: null,
  modules: new Map(),
  events: [],
  cards: new Map(), // cardId -> SRS state
  enrolled: new Set(),
  syncing: false,
  lastSync: null,
  syncError: null,
  pending: 0,
  session: null, // active review session
};

// ---------- data ----------

function randomId() {
  return crypto.randomUUID();
}

async function loadAll() {
  const [mods, events, outbox] = await Promise.all([
    state.store.getAll('modules'),
    state.store.getAll('events'),
    state.store.getAll('outbox'),
  ]);
  state.modules = new Map(mods.sort((a, b) => a.title.localeCompare(b.title)).map((m) => [m.id, m]));
  state.events = events;
  state.cards = replay(events);
  state.pending = outbox.length;
  state.enrolled = new Set(await state.store.getMeta('enrolled', []));
  state.lastSync = await state.store.getMeta('lastSync', null);
}

function itemByCardId(id) {
  const [modId, itemId] = id.split('/');
  const mod = state.modules.get(modId);
  const item = mod?.items.find((it) => it.id === itemId);
  return item ? { mod, item } : null;
}

function enrolledCardIds() {
  return [...state.modules.values()].filter((m) => state.enrolled.has(m.id)).flatMap(reviewableCardIds);
}

function currentSession() {
  return buildSession(enrolledCardIds(), state.cards, { now: Date.now(), maxNew: 10, maxReviews: 100 });
}

async function setEnrolled(moduleId, on) {
  on ? state.enrolled.add(moduleId) : state.enrolled.delete(moduleId);
  await state.store.setMeta('enrolled', [...state.enrolled]);
}

async function recordReview(id, grade) {
  const event = { eventId: randomId(), cardId: id, grade, reviewedAt: Date.now(), deviceId: state.deviceId };
  await state.store.recordReview(event);
  state.events.push(event);
  state.cards.set(id, review(state.cards.get(id) ?? newCardState(id), grade, event.reviewedAt));
  state.pending += 1;
  renderStatus();
  scheduleSync(1500);
}

// ---------- sync ----------

let syncTimer = null;
function scheduleSync(delay = 0) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

async function runSync() {
  if (state.syncing || !navigator.onLine) return renderStatus();
  state.syncing = true;
  renderStatus();
  try {
    const stats = await syncNow({ store: state.store, learnerId: state.learnerId, deviceId: state.deviceId });
    state.syncError = null;
    const reviewing = Boolean(state.session);
    await loadAll();
    // Don't yank the learner out of a card mid-review when new data arrives.
    if (!reviewing && (stats.modules || stats.events)) route();
  } catch (err) {
    state.syncError = err.message;
  } finally {
    state.syncing = false;
    renderStatus();
  }
}

function renderStatus() {
  let text;
  if (!navigator.onLine) {
    text = state.pending
      ? `Offline. ${state.pending} review${state.pending === 1 ? '' : 's'} saved on this device; they will sync when you reconnect.`
      : 'Offline. Everything you have downloaded still works.';
  } else if (state.syncing) text = 'Syncing…';
  else if (state.syncError) text = `Could not sync: ${state.syncError}. Your progress is safe on this device.`;
  else if (state.lastSync) text = `Synced ${new Date(state.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  else text = 'Not synced yet.';
  statusEl.textContent = text;
  statusEl.dataset.state = !navigator.onLine ? 'offline' : state.syncError ? 'error' : 'ok';
}

// ---------- views ----------

function setView(title, ...children) {
  state.session = null;
  document.title = `${title} · Micro-Learning`;
  view.replaceChildren(...children);
  const heading = view.querySelector('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  for (const a of document.querySelectorAll('nav a')) {
    a.toggleAttribute('aria-current', a.getAttribute('href') === (location.hash || '#/'));
  }
}

function homeView() {
  const s = currentSession();
  const mods = [...state.modules.values()];
  const summary = state.enrolled.size
    ? h('section', { class: 'card summary', 'aria-labelledby': 'today' },
        h('h2', { id: 'today' }, 'Today'),
        h('p', {}, `${s.dueCount} due for review · ${s.newCount} new`),
        s.reviews.length + s.new.length
          ? h('a', { class: 'button primary', href: '#/review' }, 'Start reviewing')
          : h('p', { class: 'muted' }, nextDue(state.cards) ? `Next review ${formatWhen(nextDue(state.cards))}.` : 'Nothing to review yet.'))
    : h('section', { class: 'card summary' },
        h('h2', {}, 'Welcome'),
        h('p', {}, 'Pick a course below and choose "Add to my reviews". Everything works offline once it has loaded.'));

  setView('Courses',
    h('h1', {}, 'Courses'),
    summary,
    mods.length
      ? h('ul', { class: 'modules' }, mods.map((m) => {
          const cards = reviewableCardIds(m);
          const due = cards.filter((id) => state.cards.get(id)?.due <= Date.now()).length;
          return h('li', { class: 'card' },
            h('h2', {}, h('a', { href: `#/module/${m.id}` }, m.title)),
            m.description ? h('p', {}, m.description) : null,
            h('p', { class: 'muted' },
              [m.items.length - cards.length ? `${m.items.length - cards.length} sections` : null, `${cards.length} practice items`, m.license.id].filter(Boolean).join(' · '),
              state.enrolled.has(m.id) ? ` · in your reviews${due ? `, ${due} due` : ''}` : ''));
        }))
      : h('p', { class: 'muted' }, navigator.onLine ? 'No courses yet. Waiting for the server…' : 'No courses downloaded yet. Connect once to download them.'),
  );
}

function moduleView(id) {
  const m = state.modules.get(id);
  if (!m) return setView('Not found', h('h1', {}, 'Course not found'), h('p', {}, h('a', { href: '#/' }, 'Back to courses')));
  const cards = reviewableCardIds(m);
  const enrolled = state.enrolled.has(m.id);
  const a = m.attribution;
  const toggle = h('button', {
    class: enrolled ? 'button' : 'button primary',
    'aria-pressed': String(enrolled),
    onclick: async () => {
      await setEnrolled(m.id, !enrolled);
      moduleView(id);
    },
  }, enrolled ? 'Remove from my reviews' : `Add to my reviews (${cards.length} items)`);

  setView(m.title,
    h('p', {}, h('a', { href: '#/' }, '← All courses')),
    h('h1', { lang: m.language }, m.title),
    m.description ? h('p', { class: 'lead', lang: m.language }, m.description) : null,
    cards.length ? h('p', {}, toggle) : null,
    h('article', { lang: m.language },
      m.items.filter((it) => it.type === 'text').map((it) =>
        h('section', { class: 'lesson' }, it.title ? h('h2', {}, it.title) : null, renderBody(it.body)))),
    h('footer', { class: 'attribution card' },
      h('h2', {}, 'Credits & license'),
      h('p', {}, attributionText(m)),
      h('p', {},
        safeLink(a.sourceUrl, 'Source'), a.sourceUrl && a.historyUrl ? ' · ' : '',
        safeLink(a.historyUrl, 'Contributors'), (a.sourceUrl || a.historyUrl) && m.license.url ? ' · ' : '',
        safeLink(m.license.url, `License (${m.license.id})`))),
  );
}

// ---------- review session ----------

function reviewView() {
  const s = currentSession();
  const queue = [...s.reviews, ...s.new];
  if (!queue.length) return doneView(0);
  setView('Review', h('h1', { class: 'visually-hidden' }, 'Review'));
  state.session = { queue, index: 0, done: 0, again: [], retried: new Set() };
  showCard();
}

function doneView(count) {
  const next = nextDue(state.cards);
  setView('Done',
    h('h1', {}, count ? 'Nice work' : 'All caught up'),
    h('p', {}, count ? `You reviewed ${count} item${count === 1 ? '' : 's'}.` : 'There is nothing due right now.'),
    next ? h('p', {}, `Next review ${formatWhen(next)}.`) : null,
    h('p', {}, h('a', { class: 'button', href: '#/' }, 'Back to courses')));
}

function showCard() {
  const ses = state.session;
  if (!ses) return;
  if (ses.index >= ses.queue.length) {
    // Missed cards get one more try at the end of the session.
    if (ses.again.length) {
      ses.queue.push(...ses.again);
      ses.again = [];
    } else {
      const n = ses.done;
      state.session = null;
      return doneView(n);
    }
  }
  const id = ses.queue[ses.index];
  const found = itemByCardId(id);
  if (!found) {
    ses.index++;
    return showCard();
  }
  const { mod, item } = found;
  const progress = h('p', { class: 'muted progress' }, `${ses.index + 1} of ${ses.queue.length} · ${mod.title}`);
  const body = item.type === 'quiz' ? quizCard(id, item) : flashCard(id, item);
  view.replaceChildren(h('h1', { class: 'visually-hidden' }, 'Review'), progress, h('div', { class: 'card review', lang: mod.language }, body));
  view.querySelector('[data-autofocus]')?.focus();
}

async function answer(id, grade) {
  const ses = state.session;
  await recordReview(id, grade);
  // A missed card comes back once more this session, not endlessly.
  if (grade < 3 && !ses.retried.has(id)) {
    ses.retried.add(id);
    ses.again.push(id);
  }
  ses.done++;
  ses.index++;
  showCard();
}

function gradeButtons(id) {
  const preview = previewIntervals(state.cards.get(id) ?? newCardState(id), Date.now());
  const labels = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
  return h('div', { class: 'grades', role: 'group', 'aria-label': 'How well did you remember?' },
    Object.keys(GRADES).map((name, i) =>
      h('button', {
        class: `button grade grade-${name}`,
        'data-key': String(i + 1),
        'data-autofocus': name === 'good' || null,
        onclick: () => answer(id, GRADES[name]),
      }, h('span', {}, labels[name]), h('small', {}, `${formatDays(preview[name])} · key ${i + 1}`))));
}

function flashCard(id, item) {
  const back = h('div', { class: 'back', hidden: true }, h('hr'), h('p', { class: 'answer' }, item.back), gradeButtons(id));
  const reveal = h('button', {
    class: 'button primary',
    'data-autofocus': true,
    'data-key': ' ',
    onclick: () => {
      reveal.remove();
      back.hidden = false;
      back.querySelector('[data-autofocus]')?.focus();
    },
  }, 'Show answer (space)');
  return [h('p', { class: 'prompt' }, item.front), reveal, back];
}

function quizCard(id, item) {
  const feedback = h('div', { class: 'feedback', role: 'status' });
  const choices = item.choices.map((c, i) =>
    h('button', {
      class: 'button choice',
      'data-key': String(i + 1),
      'data-autofocus': i === 0 || null,
      onclick: () => {
        const correct = i === item.answer;
        for (const b of choices) b.disabled = true;
        choices[item.answer].classList.add('correct');
        if (!correct) choices[i].classList.add('incorrect');
        feedback.replaceChildren(
          h('p', { class: correct ? 'ok' : 'warn' }, correct ? 'Correct.' : `Not quite. The answer is: ${item.choices[item.answer]}`),
          item.explanation ? h('p', {}, item.explanation) : null,
          h('button', {
            class: 'button primary',
            'data-key': ' ',
            onclick: () => answer(id, correct ? GRADES.good : GRADES.again),
          }, 'Continue (space)'));
        feedback.querySelector('button').focus();
      },
    }, `${i + 1}. ${c}`));
  return [h('p', { class: 'prompt' }, item.question), h('div', { class: 'choices' }, choices), feedback];
}

document.addEventListener('keydown', (e) => {
  if (!state.session || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const key = e.key === 'Enter' ? ' ' : e.key;
  // Space/Enter on a focused button already activates it natively.
  if (key === ' ' && document.activeElement instanceof HTMLButtonElement) return;
  // Pick the matching visible, enabled button.
  const btn = [...view.querySelectorAll('button[data-key]')].find(
    (b) => b.dataset.key === key && !b.disabled && !b.closest('[hidden]'),
  );
  if (btn) {
    e.preventDefault();
    btn.click();
  }
});

// ---------- my data ----------

function dataView() {
  const linkInput = h('input', { id: 'link-id', autocomplete: 'off', spellcheck: 'false', inputmode: 'text', pattern: '[A-Za-z0-9_-]{8,64}', required: true });
  const exportBtn = h('button', {
    class: 'button',
    onclick: () => {
      const blob = new Blob([JSON.stringify({ learnerId: state.learnerId, exportedAt: new Date().toISOString(), enrolled: [...state.enrolled], reviews: state.events }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'my-learning-progress.json' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  }, 'Download my progress (JSON)');

  setView('My data',
    h('h1', {}, 'My data'),
    h('section', { class: 'card' },
      h('h2', {}, 'What is stored'),
      h('p', {}, `This device holds ${state.modules.size} courses and ${state.events.length} review records. Reviews are sent to the server only so you can continue on another device. There is no account, name, or email.`),
      h('p', {}, exportBtn)),
    h('section', { class: 'card' },
      h('h2', {}, 'Use another device'),
      h('p', {}, 'Your learner code links devices. Treat it like a password: anyone with it can see your review history.'),
      h('p', {}, h('code', { class: 'learner-id' }, state.learnerId)),
      h('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const v = linkInput.value.trim();
          if (!/^[A-Za-z0-9_-]{8,64}$/.test(v) || v === state.learnerId) return;
          // Re-queue everything from this device so it merges into the linked learner.
          state.learnerId = v;
          await state.store.setMeta('learnerId', v);
          await state.store.setMeta('cursor', { modules: 0, events: 0 });
          await state.store.putMany('outbox', state.events.filter((ev) => !ev.deviceId || ev.deviceId === state.deviceId));
          await loadAll();
          scheduleSync();
          dataView();
        },
      },
        h('label', { for: 'link-id' }, 'Paste a learner code from your other device'),
        h('div', { class: 'row' }, linkInput, h('button', { class: 'button', type: 'submit' }, 'Link')))),
    h('section', { class: 'card' },
      h('h2', {}, 'Erase this device'),
      h('p', {}, 'Removes all courses and progress from this device. Reviews already synced stay on the server under your learner code.'),
      h('button', {
        class: 'button danger',
        onclick: async () => {
          if (!confirm('Erase all learning data from this device?')) return;
          await state.store.clearAll();
          location.hash = '#/';
          location.reload();
        },
      }, 'Erase this device')),
  );
}

// ---------- routing & boot ----------

function route() {
  const hash = location.hash || '#/';
  const m = /^#\/module\/([a-z0-9-]+)$/.exec(hash);
  if (m) return moduleView(m[1]);
  if (hash === '#/review') return reviewView();
  if (hash === '#/data') return dataView();
  return homeView();
}

async function boot() {
  state.store = await openStore();
  state.learnerId = await state.store.getMeta('learnerId');
  if (!state.learnerId) await state.store.setMeta('learnerId', (state.learnerId = randomId()));
  state.deviceId = await state.store.getMeta('deviceId');
  if (!state.deviceId) await state.store.setMeta('deviceId', (state.deviceId = randomId()));

  await loadAll();
  route();
  renderStatus();

  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => scheduleSync());
  window.addEventListener('offline', renderStatus);
  setInterval(() => scheduleSync(), 60_000);
  scheduleSync();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('service worker not registered', e));
  }
}

boot().catch((err) => {
  view.replaceChildren(h('h1', {}, 'Something went wrong'), h('p', {}, String(err.message ?? err)));
});

// Exposed for debugging and end-to-end tests.
window.__microlearning = { state, cardId };
