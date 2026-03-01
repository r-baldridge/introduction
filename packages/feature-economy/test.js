const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EconomicEmpowerment } = require('./index');

async function testEconomicEmpowerment() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const ee = new EconomicEmpowerment(db, cn);

  await im.init();
  await cm.init();
  await cn.init();
  await ee.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  await ee.createMutualAidFund('fund1', 'c1');
  await ee.contributeToFund('u1', 'fund1', 100);

  const balance = await ee.getFundBalance('fund1');
  assert.strictEqual(balance, 100);

  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await ee.contributeToFund('u2', 'fund1', 50),
    /must be a member/
  );

  db.close();
}

testEconomicEmpowerment().then(() => {
  console.log('feature-economy tests passed!');
}).catch((err) => {
  console.error('feature-economy tests failed:', err);
  process.exit(1);
});
