class IdentityManager {
  constructor(db) {
    this.db = db;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          data TEXT
        )
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async registerUser(id, data) {
    const existing = await this.getUser(id);
    if (existing) {
      throw new Error(`User with ID ${id} already exists`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (id, data) VALUES (?, ?)',
        [id, JSON.stringify(data)],
        (err) => {
          if (err) return reject(err);
          resolve({ ...data, id });
        }
      );
    });
  }

  async getUser(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({ ...JSON.parse(row.data), id: row.id });
      });
    });
  }
}

class ConsentManager {
  constructor(db) {
    this.db = db;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS consents (
          userId TEXT,
          permission TEXT,
          PRIMARY KEY (userId, permission)
        )
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async grantConsent(userId, permission) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO consents (userId, permission) VALUES (?, ?)',
        [userId, permission],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async revokeConsent(userId, permission) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM consents WHERE userId = ? AND permission = ?',
        [userId, permission],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async hasConsent(userId, permission) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM consents WHERE userId = ? AND permission = ?',
        [userId, permission],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/core-agency',
  IdentityManager,
  ConsentManager
};
