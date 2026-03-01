const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { CreativeExpression } = require('./index');

async function testCreativeExpression() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const ce = new CreativeExpression(db, cn);

  await im.init();
  await cm.init();
  await cn.init();
  await ce.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  await ce.startArtProject('proj1', 'Community Mural', 'c1');
  await ce.collaborateOnProject('u1', 'proj1');

  const collaborators = await ce.getCollaborators('proj1');
  assert.deepStrictEqual(collaborators, ['u1']);

  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await ce.collaborateOnProject('u2', 'proj1'),
    /must be a member/
  );

  db.close();
}

testCreativeExpression().then(() => {
  console.log('feature-culture tests passed!');
}).catch((err) => {
  console.error('feature-culture tests failed:', err);
  process.exit(1);
});
