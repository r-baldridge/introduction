const { CommunityNetwork } = require('@uplifting/core-community');

class EconomicEmpowerment {
  constructor(db, communityNetwork) {
    if (!db || !communityNetwork) {
      throw new Error('EconomicEmpowerment requires a db and CommunityNetwork');
    }
    this.db = db;
    this.communityNetwork = communityNetwork;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS funds (
          id TEXT PRIMARY KEY,
          communityId TEXT,
          balance REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS fund_members (
          fundId TEXT,
          userId TEXT,
          PRIMARY KEY (fundId, userId),
          FOREIGN KEY (fundId) REFERENCES funds(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async createMutualAidFund(fundId, communityId) {
    await this.communityNetwork.getCommunityMembers(communityId);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO funds (id, communityId, balance) VALUES (?, ?, 0)',
        [fundId, communityId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async contributeToFund(userId, fundId, amount) {
    const fund = await new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM funds WHERE id = ?', [fundId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!fund) {
      throw new Error(`Fund ${fundId} not found`);
    }

    const members = await this.communityNetwork.getCommunityMembers(fund.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${fund.communityId} to contribute`);
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        this.db.run('UPDATE funds SET balance = balance + ? WHERE id = ?', [amount, fundId]);
        this.db.run('INSERT OR IGNORE INTO fund_members (fundId, userId) VALUES (?, ?)', [fundId, userId]);
        this.db.run('COMMIT', (err) => err ? reject(err) : resolve());
      });
    });
  }

  async getFundBalance(fundId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT balance FROM funds WHERE id = ?', [fundId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error(`Fund ${fundId} not found`));
        resolve(row.balance);
      });
    });
  }
}

module.exports = {
  name: '@uplifting/feature-economy',
  EconomicEmpowerment
};
