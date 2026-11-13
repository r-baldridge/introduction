/**
 * End-to-end offline test in headless Chromium (Playwright).
 *   1. Load the app online; service worker caches the shell, modules sync into IndexedDB.
 *   2. Go offline and reload: the app and courses still load.
 *   3. Study offline: reviews are saved locally and queued.
 *   4. Reconnect: queued reviews reach the server.
 * Usage: npm run test:e2e   (SCREENSHOT_DIR=... to save screenshots)
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/server/db.js';
import { createApp, loadContentDir } from '../src/server/app.js';

// Playwright may be installed globally; require() resolves it where ESM import can't.
const { chromium } = createRequire(import.meta.url)('playwright');

const dir = await mkdtemp(join(tmpdir(), 'ml-e2e-'));
const db = openDatabase(join(dir, 'e2e.db'));
await loadContentDir(db, new URL('../content/modules/', import.meta.url).pathname);
const server = createApp({ db, log: console.error });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;
const shots = process.env.SCREENSHOT_DIR;

const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext({ deviceScaleFactor: shots ? 2 : 1, viewport: { width: 420, height: 860 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));

  // 1. Online first load.
  await page.goto(base);
  await page.getByRole('link', { name: 'Fractions: The Basics' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('link', { name: 'Fractions: The Basics' }).click();
  await page.getByRole('button', { name: /Add to my reviews/ }).click();
  await page.getByRole('button', { name: 'Remove from my reviews' }).waitFor();
  if (shots) await page.screenshot({ path: join(shots, '1-module.png'), fullPage: true });

  // 2. Offline reload.
  await context.setOffline(true);
  await page.goto(`${base}/#/`);
  await page.getByRole('heading', { name: 'Courses', level: 1 }).waitFor();
  await page.getByText('6 new').waitFor();
  assert.match(await page.locator('#status').textContent(), /Offline/);

  // 3. Study offline: 2 flashcards (keyboard) + finish the rest by clicking.
  await page.getByRole('link', { name: 'Start reviewing' }).click();
  await page.getByText('1 of 6').waitFor();
  await page.keyboard.press('Space');
  await page.getByRole('group', { name: 'How well did you remember?' }).waitFor();
  if (shots) await page.screenshot({ path: join(shots, '2-review-offline.png'), fullPage: true });
  await page.keyboard.press('3'); // Good
  await page.getByText(/^2 of /).waitFor();
  // Answer the rest by clicking; "again" answers come back once at the end.
  const done = page.getByRole('heading', { name: 'Nice work' });
  const next = page.locator('button:has-text("Show answer"), button.choice:not([disabled]), h1:has-text("Nice work")');
  for (let guard = 0; guard < 30; guard++) {
    await next.first().waitFor(); // wait for the next card to render
    if (await done.isVisible()) break;
    const reveal = page.getByRole('button', { name: /Show answer/ });
    if (await reveal.isVisible()) {
      await reveal.click();
      await page.getByRole('button', { name: /^Good/ }).click();
    } else {
      await page.locator('button.choice').first().click(); // right or wrong, both are valid paths
      await page.getByRole('button', { name: /Continue/ }).click();
    }
  }
  await done.waitFor();
  const pending = await page.evaluate(() => window.__microlearning.state.pending);
  assert.ok(pending >= 6, `expected ≥6 queued reviews, got ${pending}`);
  assert.match(await page.locator('#status').textContent(), new RegExp(`${pending} reviews saved on this device`));
  const learnerId = await page.evaluate(() => window.__microlearning.state.learnerId);
  assert.equal(db.reviewsSince(learnerId, 0).events.length, 0, 'nothing should reach the server while offline');

  // 4. Reconnect and sync.
  await context.setOffline(false);
  await page.waitForFunction(() => window.__microlearning.state.pending === 0 && !window.__microlearning.state.syncing, null, { timeout: 10000 });
  const onServer = db.reviewsSince(learnerId, 0).events;
  assert.equal(onServer.length, pending);
  assert.match(await page.locator('#status').textContent(), /Synced/);
  await page.goto(`${base}/#/`);
  await page.getByText(/Next review/).waitFor();
  if (shots) await page.screenshot({ path: join(shots, '3-home-synced.png'), fullPage: true });

  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
  console.log(`e2e ok: ${pending} reviews made offline, all ${onServer.length} synced after reconnect`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
  await rm(dir, { recursive: true, force: true });
}
