const { CommunityNetwork } = require('@uplifting/core-community');

class HealthService {
  constructor(db, communityNetwork) {
    if (!db || !communityNetwork) {
      throw new Error('HealthService requires a db and CommunityNetwork');
    }
    this.db = db;
    this.communityNetwork = communityNetwork;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS telemedicineRooms (
          id TEXT PRIMARY KEY,
          communityId TEXT
        );
        CREATE TABLE IF NOT EXISTS room_participants (
          roomId TEXT,
          userId TEXT,
          PRIMARY KEY (roomId, userId),
          FOREIGN KEY (roomId) REFERENCES telemedicineRooms(id)
        );
      `, (err) => err ? reject(err) : resolve());
    });
  }

  async createTelemedicineRoom(roomId, communityId) {
    // Basic verification that the community exists
    await this.communityNetwork.getCommunityMembers(communityId);

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO telemedicineRooms (id, communityId) VALUES (?, ?)',
        [roomId, communityId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async joinRoom(userId, roomId) {
    const room = await new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM telemedicineRooms WHERE id = ?', [roomId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const members = await this.communityNetwork.getCommunityMembers(room.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the target community ${room.communityId} to join this room`);
    }

    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO room_participants (roomId, userId) VALUES (?, ?)',
        [roomId, userId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  async getParticipants(roomId) {
    const room = await new Promise((resolve, reject) => {
      this.db.get('SELECT 1 FROM telemedicineRooms WHERE id = ?', [roomId], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    });

    if (!room) {
       throw new Error(`Room ${roomId} not found`);
    }

    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT userId FROM room_participants WHERE roomId = ?',
        [roomId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => r.userId));
        }
      );
    });
  }
}

module.exports = {
  name: '@uplifting/feature-health',
  HealthService
};
