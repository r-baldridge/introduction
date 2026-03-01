const { CommunityNetwork } = require('@uplifting/core-community');

class EducationPlatform {
  constructor(communityNetwork) {
    if (!communityNetwork) {
      throw new Error('EducationPlatform requires a CommunityNetwork');
    }
    this.communityNetwork = communityNetwork;
    this.courses = new Map();
    this.enrollments = new Map(); // Map<courseId, Set<userId>>
  }

  createCourse(courseId, title, targetCommunityId) {
    // Basic verification that the community exists
    this.communityNetwork.getCommunityMembers(targetCommunityId);

    this.courses.set(courseId, { title, targetCommunityId });
    this.enrollments.set(courseId, new Set());
  }

  enrollUser(userId, courseId) {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new Error(`Course ${courseId} not found`);
    }

    const members = this.communityNetwork.getCommunityMembers(course.targetCommunityId);
    if (!members.includes(userId)) {
      throw new Error(`User ${userId} must be a member of the target community ${course.targetCommunityId} to enroll`);
    }

    this.enrollments.get(courseId).add(userId);
  }

  getEnrollments(courseId) {
    if (!this.enrollments.has(courseId)) {
       throw new Error(`Course ${courseId} not found`);
    }
    return Array.from(this.enrollments.get(courseId));
  }
}

module.exports = {
  name: '@uplifting/feature-education',
  EducationPlatform
};
