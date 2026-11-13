# Project Catalog

A list of concrete code projects that could support each topic in the [README](./README.md). Projects are grouped by package and by the three focus areas each package lists.

- Projects marked **(Outline A/B/C)** are already specified in that package's `MODULE_OUTLINE.md`. The rest are new proposals.
- **Effort:** **S** = a weekend to a week (mostly CRUD/UI), **M** = a few weeks (some non-trivial logic or integration), **L** = a month or more (protocols, real-time, ML, or hardware).
- **Builds on** names the other projects or packages a project depends on, so you can pick a build order.

The stack assumed throughout matches the existing outlines: Node.js + Express + `sqlite3` on the server, Web Crypto / IndexedDB / PWA on the client.

---

## 0. Shared Platform Projects (build these first)

The module outlines assume some infrastructure that doesn't exist in the repo yet. Several of the projects below need these pieces.

| Project | What it does | Home | Effort |
|---|---|---|---|
| **App shell & server scaffold** | One Express app that mounts each package's routes, a shared SQLite connection and migrations, and sessions. Every outline's "Node.js API with sqlite3" assumes this exists. | new `core-platform`, or inside `core-agency` | M |
| **Test harness** | Replace the `echo "No test specified"` scripts with `node:test` and an in-memory SQLite fixture, so `npm test` actually runs. | root | S |
| **Global search utility** | SQLite FTS5 indexing and a query helper. The health outline refers to it ("the global search utility mentioned in the system architecture"), but it doesn't exist yet. | `core-community` | S |
| **Media upload service** | Multer uploads, EXIF/GPS stripping, size and type checks, consent tagging. Used by oral histories, observations, canvas exports, and intake forms. | `core-agency` | M |
| **Notification dispatcher** | In-app alerts first, then Web Push and email/SMS adapters, with per-user quiet hours and opt-outs. Used by check-ins, mutual aid, reminders, and timebank. | `core-community` | M |
| **Shared map component** | Leaflet + OpenStreetMap tiles, a bounding-box query API, and location fuzzing. Used by the foraging map, accessible routes, place-based history, and observations. | `core-community` | M |
| **Inventory & reservation engine** | Items, availability, and conflict-free bookings. Shared by the tool library, repair café, and surplus-food pickups. | `core-community` | M |
| **Moderation toolkit** | Flags, moderator queues, a transparent moderation log, and appeals. Used by the noticeboard, chronicle, translation, and mutual aid. | `core-community` | M |

---

## 1. Agency & Self-Determination — `core-agency`

### Privacy-Preserving Technologies
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Local-First Key Vault** (Outline A) | Generates keys in the browser and keeps them wrapped in IndexedDB under a PBKDF2 passphrase. Exposes `encrypt()`/`decrypt()` hooks to the other packages. | — | M |
| **Encrypted Sync Envelope** | A standard ciphertext format (AES-GCM, key version, schema version) so any package can sync encrypted blobs to SQLite without the server reading them. | Key Vault | M |
| **Metadata Scrubber** | Strips EXIF/GPS on the client and does deterministic redaction of structured fields before upload (HARDWARE_AND_SYSTEMS §4). | — | S |
| **Privacy-Safe Aggregation Library** | Adds Laplace-noise differential privacy to counts and sums, enforces k-anonymity thresholds, and tracks a privacy "budget" per dataset. Used by the environment and health aggregates. | — | M |
| **Self-Host Deployment Kit** | Scripts and a compose file to run the stack on a Raspberry Pi or mini-PC behind WireGuard, with backup and restore to an encrypted drive (HARDWARE_AND_SYSTEMS §1–3). | App shell | M |

### Decentralized Identity Systems
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **DID Wrapper** (Outline C) | Maps accounts to `did:key` with Ed25519, and serves a DID Document when the user opts in. | Key Vault | M |
| **Verifiable Vouches** | Issues trust-graph vouches as signed W3C Verifiable Credentials, so a person's reputation can move with them. | DID Wrapper, Trust Graph | L |
| **Data Portability & Deletion** | One-click export of everything a user owns as JSON with a signed manifest, and a real, verifiable account deletion. | App shell | S |
| **Device Linking & Social Recovery** | Pairs a new device with a QR code. Recovers a lost key with Shamir secret sharing split across trusted contacts. | Key Vault, Trust Graph | L |

### Informed Consent Frameworks
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Granular Consent Ledger** (Outline B) | Append-only grants and revocations, Express middleware that enforces them, and a privacy dashboard. | App shell | M |
| **Consent Receipts** | Gives the user a readable, machine-parseable receipt (what, who, why, how long, how to revoke) every time they grant consent. | Consent Ledger | S |
| **Plain-Language Consent Linter** | A CLI and test helper that fails the build if consent text is above a set reading grade, uses jargon, or leaves out a required element. | Test harness | S |
| **Data Access Transparency Log** | Shows each user who accessed their data, when, and under which grant. | Consent Ledger | M |

---

## 2. Community Building — `core-community`

### Local Connection Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Neighborhood Trust Graph** (Outline A) | Vouch edges plus recursive-CTE queries for trust distance. | DID Wrapper (optional) | M |
| **Community Noticeboard & Event Hub** (Outline C) | Notices that expire, a chronological feed, and moderation. | Moderation toolkit | S |
| **Groups & Circles Primitive** | Membership, roles, and invitations. This is the "community" object that the mutual aid, co-op, study-circle, and check-in features are scoped to. | Trust Graph | M |
| **Neighbor Introductions** | Opt-in matching of two neighbors who share an interest, with a suggested low-stakes meetup. No public profiles, no feeds. | Groups, Consent Ledger | M |

### Civic Engagement Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Asynchronous Consensus Builder** (Outline B) | Proposals, amendments, and objection-driven refinement, with a reasoning field required on every vote. | Groups | M |
| **Participatory Budgeting** | Proposal intake, a deliberation period, approval or ranked voting, and published, auditable results. | Consensus Builder | M |
| **Meeting Agenda & Minutes Kit** | Collaborative agendas, public minutes, and action items tracked to completion. | Groups | S |
| **Plain-Language Civic Explainer** | Pulls in public data (meeting calendars, ballot measures, open-data portals) and shows neutral summaries that always link to the source. | Search utility | M |

### Conflict Resolution Systems
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Structured Dialogue Facilitator** | A guided turn-taking flow in observation/feeling/need/request form. Each side has to restate the other's view before replying. | Groups | M |
| **Volunteer Mediator Matching** | Lets people request a trained community mediator, handles scheduling, and keeps case notes encrypted. | Key Vault, Notifications | M |
| **Restorative Moderation Workflow** | Sends flagged content into a repair process (notice, dialogue, agreement) as well as removal, with a public log of moderation actions. | Moderation toolkit | M |
| **Bridging-Based Discussion Ranking** | Ranks comments higher when people who usually disagree both endorse them (a Polis-style opinion clustering approach). | Consensus Builder | L |

---

## 3. Education & Knowledge Access — `feature-education`

### Open Educational Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Offline-First Micro-Learning** (Outline A) | A PWA with a service worker, IndexedDB storage for modules, and progress sync. | App shell | M |
| **Spaced-Repetition Engine** | A standalone SM-2/FSRS scheduler library for flashcards that runs fully offline. | Micro-Learning | S |
| **Open Content Importer** | Imports openly licensed content (OpenStax, Wikibooks, CC-licensed material) into modules and keeps license attribution on each item. | Micro-Learning | M |
| **Peer Study Circles** | Small groups working through a module together on a shared schedule, with shared progress and discussion prompts. | Groups, Micro-Learning | S |

### AI Tutoring Systems
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Adaptive Quiz Engine (no AI)** | Uses Bayesian knowledge tracing or mastery thresholds to pick the next question. Fully transparent, and runs offline. | Micro-Learning | M |
| **Socratic Hint Tutor** | An LLM tutor that gives graduated hints instead of answers, with educator-configurable guardrails and a local-model option for privacy. | Adaptive Quiz Engine | L |
| **Learner-Owned Progress Record** | A mastery dashboard owned by the learner, which they can export and choose to share with a tutor. | Consent Ledger, Data Portability | M |
| **Human Tutor Matching** | Connects learners to volunteer tutors through the timebank. | Timebank | S |

### Translation & Accessibility Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Community Translation Crowdsourcing** (Outline B) | Snippets, translations, and a review workflow. | Trust Graph | S |
| **Universal Accessibility Wrapper** (Outline C) | Contrast, font scaling, a dyslexia-friendly font, and text-to-speech. | — | S |
| **Machine-Translation Assist** | Pre-fills translations from an open, self-hostable engine (e.g. LibreTranslate) and marks them "needs human review". | Community Translation | M |
| **Accessibility CI Gate** | Runs axe-core with Playwright against every package's UI during `npm test`, which turns the Accessibility principle into something the build enforces. | Test harness | S |
| **Local Transcription & Captioning** | Uses Whisper.cpp to generate captions and transcripts for learning media. The same pipeline serves oral histories. | Media upload service | M |

---

## 4. Health & Wellbeing — `feature-health`

### Mental Health Support Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Mental Health Resource Directory** (Outline A) | FTS5 search over curated resources, filtered by region and tag. Statically rendered so it loads fast. | Search utility | S |
| **Privacy-First Mood & Trigger Journal** (Outline B) | Journal entries encrypted with AES-GCM on the client; only ciphertext is ever synced. | Key Vault, Sync Envelope | M |
| **Crisis-Safe UX Kit** | A reusable "get help now" component with region-aware hotline data, a quick-exit button, and a no-trace mode. | Resource Directory | S |
| **Peer Support Group Scheduler** | Facilitator-led groups with community guidelines, pseudonymous handles, and no recordings. | Groups, Notifications | M |

### Telemedicine Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Low-Bandwidth Visit Room** | Peer-to-peer WebRTC calls that fall back to audio-only automatically and never record by default. | App shell | L |
| **Community Clinic Scheduler** | Appointment booking and SMS reminders for free or volunteer clinics. | Reservation engine, Notifications | M |
| **Encrypted Pre-Visit Intake** | An intake form encrypted to the provider's public key, with an optional export in a FHIR-compatible format. | Key Vault, DID Wrapper | M |
| **Medical Interpreter Scheduling** | Books volunteer interpreters alongside visits. | Community Translation, Clinic Scheduler | S |

### Assistive Technologies
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Community Wellbeing Check-In** (Outline C) | Consented, scheduled check-ins with escalation to chosen contacts. | Groups, Notifications, Consent Ledger | M |
| **Accessible Places Map** | A crowd-sourced map of local accessibility: ramps, elevators, quiet hours, accessible restrooms. | Shared map component | M |
| **Routine & Medication Reminders** | Simple reminders in a large-type UI, with a caregiver view only if the user opts in. | Notifications, Consent Ledger | S |
| **Easy-Read Transformer** | Rewrites platform content into plain, easy-read language, using rules plus an optional LLM. | A11y Wrapper | M |
| **Voice Navigation Layer** | Navigate the platform by voice using the Web Speech API. | A11y Wrapper | M |

---

## 5. Economic Empowerment — `feature-economy`

### Microfinance & Mutual Aid Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Mutual Aid Request Board** (Outline B) | Needs and responses with status tracking, plus pseudonymous posting. | Groups, Consent Ledger | S |
| **Lending Circle Tracker** | Tracks rotating savings circles (ROSCA/susu): who has contributed, whose turn is next, and reminders. It records the circle and never handles money. | Groups, Notifications | M |
| **Mutual Aid Fund Ledger** | Public double-entry accounting for a community fund. Recipients are anonymized; totals are fully visible. | Groups, Aggregation library | M |
| **Need/Offer Matching Alerts** | Notifies people who have offered a matching kind of help when a new request is posted. | Request Board, Notifications | S |

### Skills Marketplace Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Community Timebank** (Outline A) | Time credits on a double-entry ledger, with offers and requests. | Trust Graph | M |
| **Skills Portfolio with Peer Endorsements** | Skill profiles backed by signed endorsements instead of star ratings. | Verifiable Vouches | M |
| **Local Fair-Work Board** | Local paid gigs with no platform fee and fair-pay guidance shown on each posting. | Groups, Moderation toolkit | M |
| **Mentorship & Apprenticeship Matching** | Pairs learners with experienced community members. | Timebank, Groups | S |

### Cooperative Ownership Models
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Cooperative Tool Library** (Outline C) | Inventory, conflict-free reservations, and a calendar UI. | Reservation engine | S |
| **Co-op Governance Kit** | A member registry and one-member-one-vote elections, reusing the Consensus Builder. | Consensus Builder, Groups | M |
| **Patronage Dividend Calculator** | Splits a co-op's surplus among members according to their patronage, and shows how each share was calculated. | Co-op Governance Kit | S |
| **Open-Book Finances Dashboard** | Plain-language charts of a co-op's income, costs, and reserves. | Co-op Governance Kit | M |

---

## 6. Environmental Stewardship — `feature-environment`

### Resource Sharing Networks
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Foraging & Gleaning Map** (Outline A) | Public food sources and gleaning events, shown on a map. | Shared map component | M |
| **Give-Away Exchange** | Gift-only listings with pickup coordination. | Groups, Notifications | S |
| **Surplus Food Rescue Dispatcher** | Businesses post surplus food with pickup windows, and volunteers claim the runs. | Reservation engine, Notifications | M |
| **Repair Café Organizer** | Events, item intake, and logged repair outcomes, which feed a "waste diverted" metric. | Reservation engine | S |

### Sustainability Tracking Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Household Sustainability Dashboard** (Outline B) | Personal metrics and charts, with opt-in community totals. | Aggregation library | S |
| **Emissions Factor Library** | Open, sourced conversion factors (for example kWh to CO2e by grid region) as a versioned dataset. | — | S |
| **Utility Data Importer** | Parses utility CSV or Green Button exports locally, so raw bills never leave the device. | Household Dashboard | M |
| **Community Challenges** | Opt-in neighborhood goals. Progress is shown only as privacy-preserving aggregates. | Aggregation library, Groups | M |

### Citizen Science Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Citizen Science Observation Logger** (Outline C) | A PWA for capturing photos and locations, with explicit consent for geolocation. | Media upload service, Map | M |
| **Community Validation Queue** | Experienced members review and confirm observations, and an observation becomes "research grade" once enough agree. | Observation Logger, Trust Graph | M |
| **Low-Cost Sensor Ingest** | An API and firmware recipe so Raspberry Pi or ESP32 air-quality and water sensors can push readings. | App shell, Deployment kit | L |
| **Open Data Publisher** | Exports CSV, GeoJSON, and Darwin Core, with location fuzzing for sensitive species and differential-privacy counts. | Aggregation library | M |
| **Local Government Brief Generator** | Summarizes observations into a short PDF brief to bring to a council meeting. | Open Data Publisher | S |

---

## 7. Creative Expression & Culture — `feature-culture`

### Accessible Creative Tools
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Asynchronous Collaborative Canvas** (Outline C) | Stores the artwork as a log of strokes, so it can be redrawn or replayed from the start. | App shell | M |
| **Accessible Music Maker** | A Web Audio step sequencer that works fully with a keyboard or switch device. | A11y Wrapper | M |
| **Dictation-Friendly Writing Studio** | Writing prompts with speech-to-text input and read-aloud. | A11y Wrapper | S |
| **Alt-Text Co-Authoring** | The community writes descriptions for shared artwork together, so the art is reachable by blind and low-vision members. | Canvas or Chronicle | S |

### Cultural Preservation Technology
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Audio Oral History Archive** (Outline B) | Uploads with a consent checklist and an accessible audio player. | Media upload service, Consent Ledger | M |
| **Community Language Dictionary** | Builds word lists and dictionaries for local or endangered languages, with recorded pronunciations. | Media upload service, Community Translation | M |
| **Cultural Access Protocols** | Attaches Local Contexts Traditional Knowledge (TK) and Biocultural (BC) labels to records, and restricts some records to specific groups (for example community members only). | Consent Ledger, Groups | M |
| **Place-Based History Map** | Stories and recordings pinned to the locations they're about. | Shared map component, Oral History Archive | M |
| **Recipe & Craft Heritage Archive** | Structured records of recipes and craft techniques, with credit to the people and families they come from. | Chronicle | S |

### Collaborative Storytelling Platforms
| Project | What it does | Builds on | Effort |
|---|---|---|---|
| **Collaborative Community Chronicle** (Outline A) | Revisions are saved instead of overwritten, with history and attribution. | Moderation toolkit | M |
| **Story Circles** | Asynchronous prompts that members answer in text or audio, with a facilitator curating the replies. | Groups, Transcription | S |
| **Branching Story Builder** | A choose-your-path story that the community writes together, stored as a graph of passages. | Chronicle | M |
| **Anthology Publisher** | Compiles chronicle entries into EPUB or print PDF, crediting every contributor and including only entries whose authors consented. | Chronicle, Consent Ledger | M |

---

## Suggested Build Sequence

The order follows the dependency chains above. Each step ships something usable on its own.

1. **Foundations:** Test harness → App shell → Consent Ledger → Key Vault.
2. **Community core:** Trust Graph → Groups & Circles → Moderation toolkit → Notifications.
3. **First high-approachability features (S effort, high impact):** Mutual Aid Request Board, Resource Directory + Crisis-Safe UX Kit, Community Noticeboard, Tool Library.
4. **Shared engines that unlock many projects:** Shared map component, Reservation engine, Media upload service, Aggregation library.
5. **Second wave:** Timebank, Mood Journal, Offline Micro-Learning, Oral History Archive, Observation Logger, Consensus Builder.
6. **Ambitious projects (L effort):** Verifiable Vouches, Social Recovery, Socratic Hint Tutor, Visit Room, Sensor Ingest, Bridging-Based Ranking.

### Principle Checks for Every Project

Before starting any project above, check it against the [Guiding Principles](./README.md#guiding-principles):

- **Dignity First:** Can someone ask for or offer help without being exposed?
- **Community Over Isolation:** Does it lead people to meet and work together, or to scroll alone?
- **Transparency:** Can a user see why the system did what it did (ranking, matching, moderation)?
- **Accessibility:** Does it pass the Accessibility CI Gate, and does it work offline or on a slow connection?
- **Empowerment:** Does the person stay in control? Are AI features optional, assistive, and able to be overridden?
