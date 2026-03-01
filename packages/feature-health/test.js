const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { HealthService } = require('./index');

function testHealthService() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);
  const hs = new HealthService(cn);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');
  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  hs.createTelemedicineRoom('room1', 'c1');
  hs.joinRoom('u1', 'room1');

  const participants = hs.getParticipants('room1');
  assert.deepStrictEqual(participants, ['u1']);

  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => hs.joinRoom('u2', 'room1'), /must be a member/);
}

testHealthService();
console.log('feature-health tests passed!');
