const { CommunityNetwork } = require('@uplifting/core-community');

class EnvironmentalStewardship {
  constructor(db, communityNetwork) {
    if (!db || !communityNetwork) {
      throw new Error('EnvironmentalStewardship requires a db and CommunityNetwork');
    }
    this.db = db;
    this.communityNetwork = communityNetwork;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS initiatives (
          id TEXT PRIMARY KEY,
          title TEXT,
          communityId TEXT
        );
        CREATE TABLE IF NOT EXISTS volunteers (
          initiativeId TEXT,
          userId TEXT,
          PRIMARY KEY (initiativeId, userId),
          FOREIGN KEY (initiativeId) REFERENCES initiatives(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async launchInitiative(initiativeId, title, communityId) {
    await this.communityNetwork.getCommunityMembers(communityId);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO initiatives (id, title, communityId) VALUES (?, ?, ?)',
        [initiativeId, title, communityId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async volunteerForInitiative(userId, initiativeId) {
    const initiative = await new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM initiatives WHERE id = ?', [initiativeId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!initiative) {
      throw new Error(`Initiative ${initiativeId} not found`);
    }

    const members = await this.communityNetwork.getCommunityMembers(initiative.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${initiative.communityId} to volunteer`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO volunteers (initiativeId, userId) VALUES (?, ?)',
        [initiativeId, userId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getVolunteers(initiativeId) {
    const initiative = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM initiatives WHERE id = ?', [initiativeId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!initiative) {
       throw new Error(`Initiative ${initiativeId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT userId FROM volunteers WHERE initiativeId = ?',
        [initiativeId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => r.userId));
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/feature-environment',
  EnvironmentalStewardship
};
