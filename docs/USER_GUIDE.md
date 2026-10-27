# ShareBox: User Guide & System Documentation

Welcome to **ShareBox**, the campus equipment and peer-to-peer resource sharing platform designed for college hackathons, workshops, labs, and daily campus life.

---

## 1. User Roles & Guides

### 🎓 Student / Member Guide

#### 1. Registration & Sign In
- Navigate to `#/signup` and register using your official college email (`@college.edu`).
- Select your Academic Department and Year of Study.
- Once registered, your account will enter the administrator review queue.

#### 2. Joining Events & Discovering Requests
- **Campus General Feed**: Browse requests open to all students on campus.
- **Private Event Feeds**: Tap **Events** and click **Enter Join Code** (e.g. `HACK26`) to join hackathons, workshops, or club competitions.

#### 3. Posting an Item Request or Spare Offer
- Tap **+ Post Request**.
- Choose post type: **"I Need an Item"** (Borrow) or **"I Have a Spare"** (Lend).
- Select category (*Electronics, Tools, Cables/Chargers, Stationery, Books, Costume/Props, Other*).
- Set urgency level (*Low, Medium, High, Urgent*), needed-by time, expected return deadline, and attach an optional reference photo.

#### 4. Accepting a Request ("I have this")
- In the feed, tap **I have this** on any open request you can fulfill.
- The request is immediately assigned to you via atomic transaction, preventing double-assignment.

#### 5. Real-Time Chat & Voice Calling
- Upon acceptance, a direct 1-on-1 messaging channel is opened between requester and helper.
- **Voice Calling**: Tap **📞 Call** in the chat header to initiate a peer-to-peer audio call via WebRTC.
- Use the **Mute** button to control your microphone, and tap **🛑 Hang Up** to end the call.

#### 6. Privacy-First Meeting Point Coordination
- Tap **📍 Meet** in the chat header or on the request page.
- Choose **📍 Use My Location (One-Time)** to center the map on your location once, or select a predefined campus landmark (e.g. *Central Library, Cafeteria, Auditorium*).
- Fine-tune your spot by dragging the meeting marker pin.
- Tap **Propose Meeting Point**. The other party will review and tap **Confirm Point**.

#### 7. Handover, Return & Completion
- **Handover**: When you meet physically, tap **🤝 Mark as Handed Over** to log the timestamp and attach an optional condition photo.
- **Return**: After using the equipment, the borrower taps **📦 I Have Returned This Item**.
- **Inspection & Completion**: The owner inspects the returned item and taps **✅ Received in Good Condition** to complete the transaction.

---

### 🏛️ Organizer Guide

#### 1. Creating Events
- From the navigation bar, select **Organizer** or **Events** -> **+ Create Event**.
- Fill in title, type (*Technical, Workshop, Competition, Cultural*), venue, dates, and a custom **6-character Join Code**.
- Define explicit **Event Resource & Borrowing Rules** (e.g. *"All borrowed sensors and microcontrollers must be returned before Sunday 5:00 PM"*).

#### 2. Reviewing Damage Reports & Disputes
- In the **Organizer Hub**, navigate to the **Damage Reports** tab.
- Review the owner's damage description and photographic evidence.
- Review the borrower's rebuttal statement.
- Tap **⚖️ Adjudicate & Apply Penalty**:
  - **Formal Warning**: Increments user's warning counter.
  - **Temporary Restriction (N Days)**: Suspends the user from posting requests or borrowing items for N days.
  - **Compensation Note**: Mandates physical or monetary replacement.
  - **Dismissed**: Closes dispute in cases of normal wear-and-tear.

---

### 🛡️ Platform Administrator Guide

#### 1. User Approvals & Moderation
- Open `#/admin` to access the Platform Administration Hub.
- Review newly registered students under **Pending Approvals**.
- Tap **Approve** to grant full platform access, or **Block** malicious users.

#### 2. Campus Landmarks Management
- Add, update, or remove predefined campus landmarks (e.g. *Robotics Lab, North Gate, Canteen*).
- These landmarks populate the privacy-first map picker.

---

## 2. Technical Architecture & Known Limitations

### A. College-Only Scope in v1
- Version 1 is scoped to a single institution domain (`@college.edu`). Multi-college federation is scheduled for v2.

### B. Dependence on Active Campus Community
- Peer-to-peer sharing relies on an active base of student helpers. Organizers should seed event join codes during opening ceremonies.

### C. Geolocation & Indoor GPS Drift
- GPS signals attenuate significantly inside reinforced concrete academic buildings and basements.
- **Mitigation**: ShareBox provides predefined landmark dropdowns and a draggable pin so users never depend solely on raw GPS fixes.

### D. WebRTC Peer-to-Peer Voice Calling & NAT Traversal
- ShareBox voice calling operates peer-to-peer over WebRTC using Google's public STUN servers (`stun:stun.l.google.com:19302`).
- **Strict Campus Firewalls**: If both students are connected behind strict enterprise Symmetric NAT firewalls, direct P2P audio streaming may experience ICE connection failure.
- **Enterprise Fix**: For campus networks with strict firewall rules, deploy a TURN relay server (e.g. [coturn](https://github.com/coturn/coturn) or Twilio Network Traversal) and add its credentials to `RTC_CONFIG` in `src/config/constants.js`.

---

## 3. Future Scope

1. **Multi-College Federation**: Cross-campus resource sharing for inter-college hackathons and athletic meets.
2. **Push Notifications (FCM)**: Background push notifications for incoming calls and messages when the browser tab is closed.
3. **QR-Code Verified Handover**: Scannable dynamic QR codes for instant physical handover verification.
4. **PWA & Mobile Installability**: Progressive Web App manifest with offline service workers.
