const { CommunityNetwork } = require('@uplifting/core-community');

class HealthService {
  constructor(communityNetwork) {
    if (!communityNetwork) {
      throw new Error('HealthService requires a CommunityNetwork');
    }
    this.communityNetwork = communityNetwork;
    this.telemedicineRooms = new Map(); // Map<roomId, { communityId, participants } >
  }

  createTelemedicineRoom(roomId, communityId) {
    // Basic verification that the community exists
    this.communityNetwork.getCommunityMembers(communityId);

    this.telemedicineRooms.set(roomId, {
      communityId,
      participants: new Set()
    });
  }

  joinRoom(userId, roomId) {
    const room = this.telemedicineRooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const members = this.communityNetwork.getCommunityMembers(room.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the target community ${room.communityId} to join this room`);
    }

    room.participants.add(userId);
  }

  getParticipants(roomId) {
    if (!this.telemedicineRooms.has(roomId)) {
       throw new Error(`Room ${roomId} not found`);
    }
    return Array.from(this.telemedicineRooms.get(roomId).participants);
  }
}

module.exports = {
  name: '@uplifting/feature-health',
  HealthService
};
