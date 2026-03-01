const { CommunityNetwork } = require('@uplifting/core-community');

class EducationPlatform {
  constructor(db, communityNetwork) {
    if (!db || !communityNetwork) {
      throw new Error('EducationPlatform requires a db and CommunityNetwork');
    }
    this.db = db;
    this.communityNetwork = communityNetwork;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS courses (
          id TEXT PRIMARY KEY,
          title TEXT,
          targetCommunityId TEXT
        );
        CREATE TABLE IF NOT EXISTS enrollments (
          courseId TEXT,
          userId TEXT,
          PRIMARY KEY (courseId, userId),
          FOREIGN KEY (courseId) REFERENCES courses(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async createCourse(courseId, title, targetCommunityId) {
    // Basic verification that the community exists
    await this.communityNetwork.getCommunityMembers(targetCommunityId);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO courses (id, title, targetCommunityId) VALUES (?, ?, ?)',
        [courseId, title, targetCommunityId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async enrollUser(userId, courseId) {
    const course = await new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM courses WHERE id = ?', [courseId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!course) {
      throw new Error(`Course ${courseId} not found`);
    }

    const members = await this.communityNetwork.getCommunityMembers(course.targetCommunityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the target community ${course.targetCommunityId} to enroll`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO enrollments (courseId, userId) VALUES (?, ?)',
        [courseId, userId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getEnrollments(courseId) {
    const course = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM courses WHERE id = ?', [courseId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!course) {
       throw new Error(`Course ${courseId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT userId FROM enrollments WHERE courseId = ?',
        [courseId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => r.userId));
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/feature-education',
  EducationPlatform
};
