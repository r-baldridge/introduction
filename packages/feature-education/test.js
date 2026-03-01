const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EducationPlatform } = require('./index');

async function testEducationPlatform() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const ep = new EducationPlatform(db, cn);

  await im.init();
  await cm.init();
  await cn.init();
  await ep.init();

  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  await ep.createCourse('course1', 'Intro to CS', 'c1');
  await ep.enrollUser('u1', 'course1');

  const enrolled = await ep.getEnrollments('course1');
  assert.deepStrictEqual(enrolled, ['u1']);

  await im.registerUser('u2', { name: 'Bob' });
  await assert.rejects(
    async () => await ep.enrollUser('u2', 'course1'),
    /must be a member/
  );

  db.close();
}

testEducationPlatform().then(() => {
  console.log('feature-education tests passed!');
}).catch((err) => {
  console.error('feature-education tests failed:', err);
  process.exit(1);
});
