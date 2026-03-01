const assert = require('assert');
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { CreativeExpression } = require('./index');

function testCreativeExpression() {
  const im = new IdentityManager();
  const cm = new ConsentManager();
  const cn = new CommunityNetwork(im, cm);
  const ce = new CreativeExpression(cn);

  im.registerUser('u1', { name: 'Alice' });
  cm.grantConsent('u1', 'join_communities');
  cn.createCommunity('c1', 'Local Group');
  cn.joinCommunity('u1', 'c1');

  ce.startArtProject('proj1', 'Community Mural', 'c1');
  ce.collaborateOnProject('u1', 'proj1');

  const collaborators = ce.getCollaborators('proj1');
  assert.deepStrictEqual(collaborators, ['u1']);

  im.registerUser('u2', { name: 'Bob' });
  assert.throws(() => ce.collaborateOnProject('u2', 'proj1'), /must be a member/);
}

testCreativeExpression();
console.log('feature-culture tests passed!');
