const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('./index');

async function testIdentityManager(db) {
  const manager = new IdentityManager(db);
  await manager.init();

  const user = await manager.registerUser('u1', { name: 'Alice' });
  assert.strictEqual(user.name, 'Alice');

  await assert.rejects(
    async () => await manager.registerUser('u1', { name: 'Bob' }),
    /already exists/
  );

  const retrieved = await manager.getUser('u1');
  assert.strictEqual(retrieved.name, 'Alice');
}

async function testConsentManager(db) {
  const manager = new ConsentManager(db);
  await manager.init();

  await manager.grantConsent('u1', 'join_communities');
  assert.strictEqual(await manager.hasConsent('u1', 'join_communities'), true);

  await manager.revokeConsent('u1', 'join_communities');
  assert.strictEqual(await manager.hasConsent('u1', 'join_communities'), false);
}

async function runTests() {
  const db = new sqlite3.Database(':memory:');

  try {
    await testIdentityManager(db);
    await testConsentManager(db);
    console.log('core-agency tests passed!');
  } catch (err) {
    console.error('core-agency tests failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
