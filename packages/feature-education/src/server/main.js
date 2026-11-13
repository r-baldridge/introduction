import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createApp, loadContentDir } from './app.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DB_PATH ?? resolve(ROOT, 'data/education.db');
const contentDir = process.env.CONTENT_DIR ?? resolve(ROOT, 'content/modules');

const db = openDatabase(dbPath);
const summary = await loadContentDir(db, contentDir, console.error);
console.log(`content: ${JSON.stringify(summary)} from ${contentDir}`);

const server = createApp({ db, log: console.error });
server.listen(port, () => console.log(`micro-learning server on http://localhost:${server.address().port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
}
