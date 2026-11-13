# @uplifting/feature-education

Education & Knowledge Access tools. This package implements the **Open Educational Platforms** projects from [PROJECTS.md](../../PROJECTS.md):

| Project | Where | Status |
|---|---|---|
| Spaced-Repetition Engine | `src/shared/srs.js` | ✅ SM-2, log-replay design |
| Open Content Importer | `src/importer/`, `bin/oer-import.js` | ✅ Markdown, CSV/TSV, Wikibooks/MediaWiki |
| Offline-First Micro-Learning (Outline A) | `public/` (PWA), `src/server/` (sync API) | ✅ works offline, syncs on reconnect |

There are **no npm dependencies**. It needs Node ≥ 22.5, because it uses the built-in `node:sqlite` and `node:http`.

## Quick start

```bash
npm run build    # import content/source/* → content/modules/*.json
npm start        # http://localhost:8080  (PORT, DB_PATH, CONTENT_DIR env vars)
npm test         # unit + API tests (node:test)
npm run test:e2e # headless-Chromium offline test (needs Playwright installed)
```

## How it fits together

```
content/source/*.md|csv ──oer-import──▶ content/modules/*.json ──server start──▶ SQLite (modules)
                                                                                    │
   PWA (IndexedDB: modules, review log, outbox) ◀──── POST /api/sync ────▶ SQLite (reviews)
        │
        └── src/shared/srs.js runs in the browser AND on the server (served at /lib/)
```

### Spaced-repetition engine (`src/shared/srs.js`)

- Standard **SM-2**: intervals of 1 day, then 6, then interval × easiness. Easiness never goes below 1.3.
- The **review log is the source of truth**. Card state is never stored or synced; `replay(events)` rebuilds it. Merging progress from two devices is therefore "union the logs, then replay", which can't conflict, and retried syncs are harmless because events are deduplicated by `eventId`.
- `previewIntervals()` drives the "Good · 6 days" labels on the answer buttons, so learners can see how scheduling works.
- `buildSession()` puts overdue cards first (most overdue first), then new cards in course order, with limits.
- It's pure and browser-safe, so the same file is unit-tested in Node and served to the PWA.

### Open Content Importer (`src/importer/`)

```bash
node bin/oer-import.js file lesson.md --out content/modules
node bin/oer-import.js file deck.csv --id my-deck --title "My deck" --language es --license CC-BY-4.0 --authors "Name"
node bin/oer-import.js wiki "Book Title/Chapter" --site en.wikibooks.org --user-agent "my-coop-importer/1.0 (contact@example.org)"
node bin/oer-import.js build content/source content/modules
```

- **Markdown:** front-matter metadata, `##` sections, `Q:`/`A:` flashcards, and `? question` quizzes with `- [x]` marking the answer. See `content/source/fractions-basics.md`.
- **CSV/TSV:** `front,back` columns (`question/answer` and `term/definition` also work). Metadata comes from flags or a sidecar `deck.json`.
- **Wikibooks / any MediaWiki:** the license is read from the wiki itself (`rightsinfo`), not assumed. Attribution links to the exact revision imported and to the page history. Wikimedia asks automated clients to send a descriptive User-Agent with contact details, so pass `--user-agent`.
- **License policy** (`licenses.js`): converting a source into learning items counts as an adaptation, so NoDerivatives (ND) licenses are refused. NonCommercial (NC) licenses need `--allow-nc`. Unknown licenses are refused. ShareAlike (SA) content keeps its license. Every module carries TASL attribution (title, author, source, license) and a note that it was modified, and the PWA displays both.
- **Stable item IDs:** IDs come from the content (heading slugs, hashes of questions), so re-importing an edited source keeps learners' progress on the items that didn't change.

### Offline-first PWA + sync server

- The service worker caches the app shell (stale-while-revalidate). Modules and progress live in **IndexedDB**, so after one online visit the whole app works offline.
- Each review is written to the local log and to an **outbox** in a single transaction. `POST /api/sync` pushes the outbox and pulls changed modules plus this learner's reviews from other devices, using cursors.
- **Identity is pseudonymous:** a random learner code is generated on the device. There is no account, name, or email. The code links devices together, so it should be treated like a password. Moving to `core-agency` identity is a planned next step.
- Learners can export their full history as JSON and erase the device from the "My data" page.
- The content is untrusted, so the PWA renders it only as text, and the server sends a strict Content-Security-Policy. Requests are validated and size-limited.
- Accessibility: keyboard shortcuts (Space to reveal, 1–4 to grade), 48px tap targets, focus management on view changes, a live status region, dark mode, and reduced motion.

## Known limitations / next steps

- **FSRS scheduler:** the engine API is designed so that a second scheduler can be added next to SM-2.
- **Live Wikibooks import isn't verified yet.** It was built and tested against recorded API responses, because this development environment's network blocks `wikibooks.org`.
- The MediaWiki importer produces text sections only. Adding practice items to imported text is a natural follow-on (the Socratic Hint Tutor, or human authoring).
- The review log for a learner code is readable by anyone who has that code. Integrating real authentication via `core-agency` is the fix.
- `node:sqlite` still prints an experimental-feature warning on Node 22. The npm scripts suppress it.
