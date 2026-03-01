const { CommunityNetwork } = require('@uplifting/core-community');

class CreativeExpression {
  constructor(communityNetwork) {
    if (!communityNetwork) {
      throw new Error('CreativeExpression requires a CommunityNetwork');
    }
    this.communityNetwork = communityNetwork;
    this.artProjects = new Map(); // Map<projectId, { communityId, title, collaborators } >
  }

  startArtProject(projectId, title, communityId) {
    this.communityNetwork.getCommunityMembers(communityId);

    this.artProjects.set(projectId, {
      communityId,
      title,
      collaborators: new Set()
    });
  }

  collaborateOnProject(userId, projectId) {
    const project = this.artProjects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const members = this.communityNetwork.getCommunityMembers(project.communityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the community ${project.communityId} to collaborate`);
    }

    project.collaborators.add(userId);
  }

  getCollaborators(projectId) {
    if (!this.artProjects.has(projectId)) {
       throw new Error(`Project ${projectId} not found`);
    }
    return Array.from(this.artProjects.get(projectId).collaborators);
  }
}

module.exports = {
  name: '@uplifting/feature-culture',
  CreativeExpression
};
