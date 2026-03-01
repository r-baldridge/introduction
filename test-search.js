const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');
const { CommunityNetwork } = require('@uplifting/core-community');
const { EducationPlatform } = require('@uplifting/feature-education');
const { HealthService } = require('@uplifting/feature-health');
const { EconomicEmpowerment } = require('@uplifting/feature-economy');
const { EnvironmentalStewardship } = require('@uplifting/feature-environment');
const { CreativeExpression } = require('@uplifting/feature-culture');
const { searchUserEngagements } = require('./search');

async function testGlobalSearch() {
  const db = new sqlite3.Database(':memory:');

  const im = new IdentityManager(db);
  const cm = new ConsentManager(db);
  const cn = new CommunityNetwork(db, im, cm);
  const edu = new EducationPlatform(db, cn);
  const health = new HealthService(db, cn);
  const econ = new EconomicEmpowerment(db, cn);
  const env = new EnvironmentalStewardship(db, cn);
  const cult = new CreativeExpression(db, cn);

  // Initialize all databases
  await im.init(); await cm.init(); await cn.init();
  await edu.init(); await health.init(); await econ.init();
  await env.init(); await cult.init();

  // Create User
  await im.registerUser('u1', { name: 'Alice' });
  await cm.grantConsent('u1', 'join_communities');

  // Create Community and Join
  await cn.createCommunity('c1', 'Local Group');
  await cn.joinCommunity('u1', 'c1');

  // Engage across all packages
  await edu.createCourse('edu1', 'Biology', 'c1');
  await edu.enrollUser('u1', 'edu1');

  await health.createTelemedicineRoom('room1', 'c1');
  await health.joinRoom('u1', 'room1');

  await econ.createMutualAidFund('fund1', 'c1');
  await econ.contributeToFund('u1', 'fund1', 500);

  await env.launchInitiative('env1', 'River Cleanup', 'c1');
  await env.volunteerForInitiative('u1', 'env1');

  await cult.startArtProject('art1', 'Town Mural', 'c1');
  await cult.collaborateOnProject('u1', 'art1');

  // Perform search
  const profile = await searchUserEngagements(db, 'u1');

  assert.strictEqual(profile.userId, 'u1');
  assert.strictEqual(profile.communities.length, 1);
  assert.strictEqual(profile.communities[0].name, 'Local Group');
  assert.strictEqual(profile.courses.length, 1);
  assert.strictEqual(profile.courses[0].title, 'Biology');
  assert.strictEqual(profile.telemedicineRooms.length, 1);
  assert.strictEqual(profile.funds.length, 1);
  assert.strictEqual(profile.funds[0].balance, 500);
  assert.strictEqual(profile.initiatives.length, 1);
  assert.strictEqual(profile.initiatives[0].title, 'River Cleanup');
  assert.strictEqual(profile.artProjects.length, 1);
  assert.strictEqual(profile.artProjects[0].title, 'Town Mural');

  db.close();
}

testGlobalSearch().then(() => {
  console.log('search tests passed!');
}).catch((err) => {
  console.error('search tests failed:', err);
  process.exit(1);
});
