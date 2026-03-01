const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');

class CommunityNetwork {
  constructor(db, identityManager, consentManager) {
    if (!db || !identityManager || !consentManager) {
      throw new Error('CommunityNetwork requires db, IdentityManager, and ConsentManager');
    }
    this.db = db;
    this.identityManager = identityManager;
    this.consentManager = consentManager;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS communities (
          id TEXT PRIMARY KEY,
          name TEXT
        );
        CREATE TABLE IF NOT EXISTS community_members (
          communityId TEXT,
          userId TEXT,
          PRIMARY KEY (communityId, userId),
          FOREIGN KEY (communityId) REFERENCES communities(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async createCommunity(id, name) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO communities (id, name) VALUES (?, ?)',
        [id, name],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return reject(new Error(`Community ${id} already exists`));
            }
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  async joinCommunity(userId, communityId) {
    const user = await this.identityManager.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const hasConsent = await this.consentManager.hasConsent(userId, 'join_communities');
    if (!hasConsent) {
      throw new Error(`User ${userId} has not consented to join communities`);
    }

    const communityExists = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM communities WHERE id = ?', [communityId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!communityExists) {
      throw new Error(`Community ${communityId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO community_members (communityId, userId) VALUES (?, ?)',
        [communityId, userId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getCommunityMembers(communityId) {
    const communityExists = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM communities WHERE id = ?', [communityId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!communityExists) {
      throw new Error(`Community ${communityId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT userId FROM community_members WHERE communityId = ?',
        [communityId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => r.userId));
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/core-community',
  CommunityNetwork
};
