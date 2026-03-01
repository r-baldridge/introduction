const { CommunityNetwork } = require('@uplifting/core-community');

class EnvironmentalStewardship {
  constructor(communityNetwork) {
    if (!communityNetwork) {
      throw new Error('EnvironmentalStewardship requires a CommunityNetwork');
    }
    this.communityNetwork = communityNetwork;
    this.initiatives = new Map(); // Map<initiativeId, { communityId, title, volunteers } >
  }

  launchInitiative(initiativeId, title, communityId) {
    this.communityNetwork.getCommunityMembers(communityId);

    this.initiatives.set(initiativeId, {
      communityId,
      title,
      volunteers: new Set()
    });
  }

  volunteerForInitiative(userId, initiativeId) {
    const initiative = this.initiatives.get(initiativeId);
    if (!initiative) {
      throw new Error(`Initiative ${initiativeId} not found`);
    }

    const members = this.communityNetwork.getCommunityMembers(initiative.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${initiative.communityId} to volunteer`);
    }

    initiative.volunteers.add(userId);
  }

  getVolunteers(initiativeId) {
    if (!this.initiatives.has(initiativeId)) {
       throw new Error(`Initiative ${initiativeId} not found`);
    }
    return Array.from(this.initiatives.get(initiativeId).volunteers);
  }
}

module.exports = {
  name: '@uplifting/feature-environment',
  EnvironmentalStewardship
};
