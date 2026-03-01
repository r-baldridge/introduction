const { CommunityNetwork } = require('@uplifting/core-community');

class EconomicEmpowerment {
  constructor(communityNetwork) {
    if (!communityNetwork) {
      throw new Error('EconomicEmpowerment requires a CommunityNetwork');
    }
    this.communityNetwork = communityNetwork;
    this.funds = new Map(); // Map<fundId, { communityId, balance, members } >
  }

  createMutualAidFund(fundId, communityId) {
    this.communityNetwork.getCommunityMembers(communityId);

    this.funds.set(fundId, {
      communityId,
      balance: 0,
      members: new Set()
    });
  }

  contributeToFund(userId, fundId, amount) {
    const fund = this.funds.get(fundId);
    if (!fund) {
      throw new Error(`Fund ${fundId} not found`);
    }

    const members = this.communityNetwork.getCommunityMembers(fund.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${fund.communityId} to contribute`);
    }

    fund.balance += amount;
    fund.members.add(userId);
  }

  getFundBalance(fundId) {
    if (!this.funds.has(fundId)) {
       throw new Error(`Fund ${fundId} not found`);
    }
    return this.funds.get(fundId).balance;
  }
}

module.exports = {
  name: '@uplifting/feature-economy',
  EconomicEmpowerment
};
