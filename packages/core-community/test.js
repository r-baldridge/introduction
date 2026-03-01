const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('./index');

function testCommunityNetwork() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');

  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  const members = cn.getCommunityMembers('c1');
  assert.deepStrictEqual(members, ['u1']);

  // Test no consent
  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => cn.joinCommunity('u2', 'c1'), /has not consented/);
}

testCommunityNetwork();
console.log('core-community tests passed!');
