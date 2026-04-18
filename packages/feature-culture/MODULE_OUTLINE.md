# Creative Expression & Culture Module Outline

## 1. Field Research & Overview
Creative Expression & Culture technologies aim to lower barriers to artistry, preserve diverse heritages, and facilitate collaborative storytelling. The goal is to provide platforms where culture is actively created and documented by communities, rather than passively consumed from centralized media entities.

Key areas identified:
- **Accessible Creative Tools:** Digital tools that simplify art creation (music, visual, writing) for beginners or those with disabilities.
- **Cultural Preservation Technology:** Archival systems designed to document and share local history, languages, and traditions securely and respectfully.
- **Collaborative Storytelling Platforms:** Environments where multiple users can weave narratives together, amplifying diverse voices.

## 2. Impactful & Approachable Development Options

### Option A: Collaborative Community Chronicle
**Concept:** A digital "quilt" or living document where community members can add short stories, historical anecdotes, or folklore related to their shared space.
**Impact:** Builds a shared sense of history and identity.
**Approachability:** High. A text-focused CMS with version history and collaborative editing features.

### Option B: Audio Oral History Archive
**Concept:** A platform designed specifically for recording, uploading, and categorizing oral histories from elders or community leaders.
**Impact:** Crucial for preserving unwritten histories and languages.
**Approachability:** Medium. Requires handling audio file uploads, providing an accessible in-browser audio player, and structuring rich metadata.

### Option C: Asynchronous Collaborative Canvas
**Concept:** A shared digital canvas where users can contribute to a visual art piece over time, pixel by pixel or vector by vector.
**Impact:** Lowers the barrier to participation in visual arts and creates a tangible community artifact.
**Approachability:** Medium. Involves Canvas API or SVG manipulation and careful state synchronization.

## 3. Development Outlines & Referenced Documentation

### Outline for Collaborative Community Chronicle (Option A)

**Architecture:**
- **Frontend:** Rich text editor integration.
- **Backend:** Node.js/SQLite with version control for documents.
- **Data Model:** `Document` (id, title), `DocumentRevision` (id, documentId, authorId, content, timestamp).

**Development Steps:**
1. Integrate a lightweight, accessible WYSIWYG editor (e.g., Quill or ProseMirror).
2. Build the API to save revisions rather than overwriting content.
3. Develop a UI to view the history of a document and see who contributed what.

**Referenced Documentation:**
- [ProseMirror Documentation](https://prosemirror.net/)
- [Operational Transformation Concepts (for future real-time collaboration)](https://en.wikipedia.org/wiki/Operational_transformation)

### Outline for Audio Oral History Archive (Option B)

**Architecture:**
- **Backend:** Audio file storage and metadata management.
- **Integration:** Utilizes `core-agency` to ensure explicit consent is given for how the audio can be used or shared.
- **Data Model:** `AudioRecord` (id, uploaderId, subjectName, tags, filePath, transcript).

**Development Steps:**
1. Implement secure file upload handling in Node.js (e.g., using Multer).
2. Build a custom, accessible HTML5 audio player interface.
3. Integrate a consent checklist UI before an upload is finalized.

**Referenced Documentation:**
- [MDN Web Docs: HTMLAudioElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement)
- [Multer (Node.js middleware for handling multipart/form-data)](https://github.com/expressjs/multer)

### Outline for Collaborative Canvas (Option C)

**Architecture:**
- **Frontend:** HTML5 `<canvas>` element.
- **Backend:** Stores drawing instructions (strokes) rather than a flat image file, allowing the artwork to be redrawn or animated from the beginning.
- **Data Model:** `Canvas` (id, name), `Stroke` (id, canvasId, userId, color, pathData, timestamp).

**Development Steps:**
1. Implement a basic drawing interface using the Canvas API.
2. Serialize drawing strokes into JSON/SVG paths and send them to the API.
3. On load, fetch all strokes for a canvas and render them sequentially.

**Referenced Documentation:**
- [MDN Web Docs: Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [SVG Path Data Syntax](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d)
