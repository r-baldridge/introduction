const assert = require('assert');
const { IdentityManager, ConsentManager } = require('./index');

function testIdentityManager() {
  const manager = new IdentityManager();
  const user = manager.registerUser('u1', { name: 'Alice' });
  assert.strictEqual(user.name, 'Alice');
  assert.throws(() => manager.registerUser('u1', { name: 'Bob' }), /already exists/);
}

function testConsentManager() {
  const manager = new ConsentManager();
  manager.grantConsent('u1', 'join_communities');
  assert.strictEqual(manager.hasConsent('u1', 'join_communities'), true);
  manager.revokeConsent('u1', 'join_communities');
  assert.strictEqual(manager.hasConsent('u1', 'join_communities'), false);
}

testIdentityManager();
testConsentManager();
console.log('core-agency tests passed!');
