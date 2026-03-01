const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EconomicEmpowerment } = require('./index');

function testEconomicEmpowerment() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);
  const ee = new EconomicEmpowerment(cn);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');
  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  ee.createMutualAidFund('fund1', 'c1');
  ee.contributeToFund('u1', 'fund1', 100);

  const balance = ee.getFundBalance('fund1');
  assert.strictEqual(balance, 100);

  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => ee.contributeToFund('u2', 'fund1', 50), /must be a member/);
}

testEconomicEmpowerment();
console.log('feature-economy tests passed!');
