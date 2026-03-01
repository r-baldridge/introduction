const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EnvironmentalStewardship } = require('./index');

function testEnvironmentalStewardship() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);
  const es = new EnvironmentalStewardship(cn);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');
  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  es.launchInitiative('init1', 'Park Cleanup', 'c1');
  es.volunteerForInitiative('u1', 'init1');

  const volunteers = es.getVolunteers('init1');
  assert.deepStrictEqual(volunteers, ['u1']);

  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => es.volunteerForInitiative('u2', 'init1'), /must be a member/);
}

testEnvironmentalStewardship();
console.log('feature-environment tests passed!');
