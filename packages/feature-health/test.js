const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { HealthService } = require('./index');

async function testHealthService() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const hs = new HealthService(db, cn);

  await im.init();
  await cm.init();
  await cn.init();
  await hs.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  await hs.createTelemedicineRoom('room1', 'c1');
  await hs.joinRoom('u1', 'room1');

  const participants = await hs.getParticipants('room1');
  assert.deepStrictEqual(participants, ['u1']);

  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await hs.joinRoom('u2', 'room1'),
    /must be a member/
  );

  db.close();
}

testHealthService().then(() => {
  console.log('feature-health tests passed!');
}).catch((err) => {
  console.error('feature-health tests failed:', err);
  process.exit(1);
});
