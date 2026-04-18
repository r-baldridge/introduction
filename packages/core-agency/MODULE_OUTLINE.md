# Agency & Self-Determination Module Outline

## 1. Field Research & Overview
Agency & Self-Determination (`core-agency`) is the bedrock of this entire ecosystem. It ensures that users retain control over their identity, data, and how they interact with technology. The focus is on reversing the standard paradigm where platforms own user data, instead making the platform a temporary custodian acting only with explicit, revocable consent.

Key areas identified:
- **Privacy-Preserving Technologies:** Systems that protect personal data, often using local storage or encryption to keep data out of centralized hands.
- **Decentralized Identity Systems:** Frameworks that give individuals portable control over their digital presence, rather than relying on centralized corporate identity providers.
- **Informed Consent Frameworks:** Interfaces and protocols that ensure users genuinely understand and control what they are agreeing to.

## 2. Impactful & Approachable Development Options

### Option A: Local-First Key Management Service
**Concept:** A utility that generates cryptographic keys entirely in the browser, storing them in a secure local enclave, to be used for encrypting data before it ever reaches the server.
**Impact:** Guarantees that the platform operators cannot read sensitive user data (e.g., in the Health or Culture modules).
**Approachability:** Medium. Relies heavily on the standard Web Crypto API.

### Option B: Granular Consent Ledger
**Concept:** Instead of a single "Accept Terms and Conditions" checkbox, this is a dashboard where users can toggle permissions for specific data uses (e.g., "Allow anonymized use in Environmental aggregates", "Allow neighbor A to view my mutual aid requests").
**Impact:** operationalizes the principle of "Informed Consent."
**Approachability:** High. Primarily a well-structured database schema and a clear, jargon-free UI.

### Option C: Decentralized Identifier (DID) Wrapper
**Concept:** A lightweight module that maps internal user accounts to W3C Decentralized Identifiers, allowing future interoperability and portable reputation.
**Impact:** Future-proofs the identity system and aligns with global self-sovereign identity standards.
**Approachability:** Low-to-Medium. Requires understanding the DID specification, though simple implementations (like `did:key` or `did:web`) are straightforward to generate.

## 3. Development Outlines & Referenced Documentation

### Outline for Local-First Key Management (Option A)

**Architecture:**
- **Frontend Only:** All operations happen in the client.
- **Storage:** `IndexedDB` or `localStorage` to hold the wrapped/encrypted private key, protected by a user passphrase.

**Development Steps:**
1. Create a utility module wrapping `window.crypto.subtle`.
2. Implement functions for `generateKey`, `exportKey` (encrypted via PBKDF2 derived from a password), and `importKey`.
3. Provide hook functions for other packages to encrypt payloads before making API calls.

**Referenced Documentation:**
- [MDN Web Docs: Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [W3C Web Cryptography API Specification](https://www.w3.org/TR/WebCryptoAPI/)

### Outline for Granular Consent Ledger (Option B)

**Architecture:**
- **Backend:** Node.js API with `sqlite3`.
- **Data Model:** `User` (id), `DataContext` (id, description), `ConsentGrant` (id, userId, contextId, grantedAt, revokedAt).
- **Middleware:** Express middleware that checks the `ConsentGrant` table before serving specific types of data to other users or aggregating it.

**Development Steps:**
1. Define the SQL schema to track the history of consent (append-only ledger style).
2. Build the middleware function to enforce consent checks on specific routes.
3. Create a unified "Privacy Dashboard" UI for the user to manage these toggles.

**Referenced Documentation:**
- [GDPR Consent Guidelines](https://gdpr.eu/gdpr-consent-requirements/)
- [Express Middleware Documentation](https://expressjs.com/en/guide/writing-middleware.html)

### Outline for Decentralized Identifier Wrapper (Option C)

**Architecture:**
- **Backend:** Utility to generate a DID document associated with a user profile.
- **Data Model:** `UserIdentity` (id, userId, didString).

**Development Steps:**
1. Implement a basic `did:key` generator using Ed25519 key pairs.
2. Create an endpoint that serves a standard DID Document for a given user (if they have opted to make it public).
3. Integrate this identifier into the `core-community` trust graph.

**Referenced Documentation:**
- [W3C Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-core/)
- [did:key Method Specification](https://w3c-ccg.github.io/did-method-key/)
