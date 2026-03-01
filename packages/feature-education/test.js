const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EducationPlatform } = require('./index');

function testEducationPlatform() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);
  const ep = new EducationPlatform(cn);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');
  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  ep.createCourse('course1', 'Intro to CS', 'c1');
  ep.enrollUser('u1', 'course1');

  const enrolled = ep.getEnrollments('course1');
  assert.deepStrictEqual(enrolled, ['u1']);

  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => ep.enrollUser('u2', 'course1'), /must be a member/);
}

testEducationPlatform();
console.log('feature-education tests passed!');
