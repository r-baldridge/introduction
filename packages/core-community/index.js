const { IdentityManager, ConsentManager } = require('@uplifting/core-agency');

class CommunityNetwork {
  constructor(identityManager, consentManager) {
    if (!identityManager || !consentManager) {
      throw new Error('CommunityNetwork requires an IdentityManager and ConsentManager');
    }
    this.identityManager = identityManager;
    this.consentManager = consentManager;
    this.communities = new Map(); // Map<communityId, Set<userId>>
  }

  createCommunity(communityId, name) {
    if (this.communities.has(communityId)) {
      throw new Error(`Community ${communityId} already exists`);
    }
    this.communities.set(communityId, { name, members: new Set() });
  }

  joinCommunity(userId, communityId) {
    const user = this.identityManager.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Check if user has consented to join communities
    if (!this.consentManager.hasConsent(userId, 'join_communities')) {
      throw new Error(`User ${userId} has not consented to join communities`);
    }

    if (!this.communities.has(communityId)) {
      throw new Error(`Community ${communityId} not found`);
    }

    this.communities.get(communityId).members.add(userId);
  }

  getCommunityMembers(communityId) {
    if (!this.communities.has(communityId)) {
      throw new Error(`Community ${communityId} not found`);
    }
    return Array.from(this.communities.get(communityId).members);
  }
}

module.exports = {
  name: '@uplifting/core-community',
  CommunityNetwork
};
