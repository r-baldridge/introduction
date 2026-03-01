const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EnvironmentalStewardship } = require('./index');

async function testEnvironmentalStewardship() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const es = new EnvironmentalStewardship(db, cn);

  await im.init();
  await cm.init();
  await cn.init();
  await es.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  await es.launchInitiative('init1', 'Park Cleanup', 'c1');
  await es.volunteerForInitiative('u1', 'init1');

  const volunteers = await es.getVolunteers('init1');
  assert.deepStrictEqual(volunteers, ['u1']);

  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await es.volunteerForInitiative('u2', 'init1'),
    /must be a member/
  );

  db.close();
}

testEnvironmentalStewardship().then(() => {
  console.log('feature-environment tests passed!');
}).catch((err) => {
  console.error('feature-environment tests failed:', err);
  process.exit(1);
});
