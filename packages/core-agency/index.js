class IdentityManager {
  constructor() {
    this.users = new Map();
  }

  registerUser(id, data) {
    if (this.users.has(id)) {
      throw new Error(`User with ID ${id} already exists`);
    }
    this.users.set(id, { id, ...data });
    return this.users.get(id);
  }

  getUser(id) {
    return this.users.get(id);
  }
}

class ConsentManager {
  constructor() {
    this.consents = new Map(); // Map<userId, Set<permission>>
  }

  grantConsent(userId, permission) {
    if (!this.consents.has(userId)) {
      this.consents.set(userId, new Set());
    }
    this.consents.get(userId).add(permission);
  }

  revokeConsent(userId, permission) {
    if (this.consents.has(userId)) {
      this.consents.get(userId).delete(permission);
    }
  }

  hasConsent(userId, permission) {
    return this.consents.has(userId) && this.consents.get(userId).has(permission);
  }
}

module.exports = {
  name: '@uplifting/core-agency',
  IdentityManager,
  ConsentManager
};
