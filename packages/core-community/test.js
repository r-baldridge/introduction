const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('./index');

async function testCommunityNetwork() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);

  await im.init();
  await cm.init();
  await cn.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');

  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  const members = await cn.getCommunityMembers('c1');
  assert.deepStrictEqual(members, ['u1']);

  // Test no consent
  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await cn.joinCommunity('u2', 'c1'),
    /has not consented/
  );

  db.close();
}

testCommunityNetwork().then(() => {
  console.log('core-community tests passed!');
}).catch((err) => {
  console.error('core-community tests failed:', err);
  process.exit(1);
});
