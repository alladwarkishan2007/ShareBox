# ShareBox 
**Campus Resource Sharing & Peer-to-Peer Equipment Coordination Platform**

ShareBox is a complete, autonomous web application built for college campuses and events. During hackathons, technical fests, labs, and workshops, equipment gets misplaced, damaged, or remains inaccessible. ShareBox empowers students and organizers to post requests, accept items with race-condition-safe transactions, communicate via real-time chat and WebRTC voice calls, coordinate meeting points safely without live GPS tracking, and enforce accountability through damage reporting and borrowing restrictions.

---

##  Key Features

- **College-Restricted Authentication**: Sign up restricted strictly to institution email addresses (`@college.edu`), with email verification and an administrative approval queue.
- **Event & Community Scoping**: Requests are partitioned by event (e.g. Hackathon 2026, Robotics Workshop) or shared across the campus-wide community.
- **Transaction-Safe Acceptance**: Atomic Firestore transactions guarantee that no two students can accept the same item request simultaneously.
- **Real-Time In-App Chat**: Live messaging thread created automatically upon acceptance with timestamps, seen indicators, and pinned quick actions.
- **WebRTC Voice Calling**: Audio-only peer-to-peer calling using Firestore signaling and Google STUN servers with graceful fallback for connection issues.
- **Privacy-First Geolocation**: One-shot `getCurrentPosition` triggered solely on demand when picking a meeting point. Zero continuous tracking, zero raw GPS history stored.
- **Damage Accountability System**: Two-step verified handover condition logs, damage dispute filing, borrower rebuttals, and organizer-enforced borrowing bans.
- **Administrative Oversight**: Admin & Organizer dashboards for approving users, reviewing damage disputes, managing campus landmarks, and tracking metrics.

---

##  Tech Stack

- **Frontend**: HTML5, CSS3 (Mobile-First CSS Custom Properties / Design Tokens), Vanilla JavaScript (ES Modules).
- **Bundler & Tooling**: Vite 5.
- **Backend (BaaS)**: Firebase v10+ Modular SDK (Authentication, Cloud Firestore, Cloud Storage, Hosting).
- **Local Emulation**: Firebase Local Emulator Suite.
- **Voice Calling**: WebRTC Audio-Only Peer-to-Peer + Google STUN (`stun.l.google.com:19302`).
- **Maps**: Leaflet.js + OpenStreetMap (OSM) tile servers (100% free, no paid API keys required).

---

##  Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
```bash
cd sharebox
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your Firebase configuration and campus domain:
```bash
cp .env.example .env
```
Key configuration parameters:
- `VITE_COLLEGE_EMAIL_DOMAIN`: Domain restriction (e.g. `college.edu`).
- `VITE_USE_FIREBASE_EMULATOR`: Set to `true` to use the Firebase Local Emulator Suite.

### 4. Running the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 5. Running with Firebase Emulator Suite (Optional)
```bash
firebase emulators:start
```
The Emulator UI will be accessible at `http://localhost:4000`.

---

##  Project Directory Structure

```
sharebox/
├── index.html                     # SPA Entry shell
├── vite.config.js                 # Vite bundler configuration
├── package.json                   # Dependencies & scripts
├── firebase.json                  # Firebase hosting, firestore, storage, and emulator config
├── firestore.rules                # Granular RBAC, status transitions, participant guards
├── firestore.indexes.json         # Composite indexes for filtered & sorted queries
├── storage.rules                  # Strict size (<5MB) and image MIME-type guards
│
├── src/
│   ├── main.js                    # App bootstrap & auth state listener
│   ├── router.js                  # Client-side router with route protection and role guards
│   ├── config/                    # Firebase setup & system constants
│   ├── styles/                    # Design tokens, reset, components, page layouts
│   ├── utils/                     # Sanitizer (anti-XSS), validators, date formatters, role guards
│   ├── services/                  # Firebase Auth, Requests, Chat, WebRTC Calls, Location, Reports
│   ├── components/                # Reusable UI widgets (Navbar, Toast, Modal, StatusBadge)
│   └── pages/                     # SPA views (Landing, Auth, Feed, Detail, Dashboards, Profile)
│
├── scripts/
│   └── seed-data.js               # Demo seeder for campus landmarks, events, and requests
└── docs/                          # Architecture, data model, and user guides
```

---

##  Security Design Highlights
- **Strict Content Sanitization**: All user-provided strings are sanitized through `escapeHTML` to prevent Cross-Site Scripting (XSS).
- **No Unsafe InnerHTML**: Template strings avoid raw user interpolation.
- **Firestore Security Rules**: Field-level validation, enforced status transitions, participant-only chat/call access, and ban enforcement.
- **Upload Constraints**: Cloud Storage restricts uploads strictly to images under 5 MB.
