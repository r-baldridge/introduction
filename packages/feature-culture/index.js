const { CommunityNetwork } = require('@uplifting/core-community');

class CreativeExpression {
  constructor(db, communityNetwork) {
    if (!db || !communityNetwork) {
      throw new Error('CreativeExpression requires a db and CommunityNetwork');
    }
    this.db = db;
    this.communityNetwork = communityNetwork;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS artProjects (
          id TEXT PRIMARY KEY,
          title TEXT,
          communityId TEXT
        );
        CREATE TABLE IF NOT EXISTS collaborators (
          projectId TEXT,
          userId TEXT,
          PRIMARY KEY (projectId, userId),
          FOREIGN KEY (projectId) REFERENCES artProjects(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async startArtProject(projectId, title, communityId) {
    await this.communityNetwork.getCommunityMembers(communityId);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO artProjects (id, title, communityId) VALUES (?, ?, ?)',
        [projectId, title, communityId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async collaborateOnProject(userId, projectId) {
    const project = await new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM artProjects WHERE id = ?', [projectId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const members = await this.communityNetwork.getCommunityMembers(project.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${project.communityId} to collaborate`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO collaborators (projectId, userId) VALUES (?, ?)',
        [projectId, userId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getCollaborators(projectId) {
    const project = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM artProjects WHERE id = ?', [projectId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!project) {
       throw new Error(`Project ${projectId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT userId FROM collaborators WHERE projectId = ?',
        [projectId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => r.userId));
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/feature-culture',
  CreativeExpression
};
