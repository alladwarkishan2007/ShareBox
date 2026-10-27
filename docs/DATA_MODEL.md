# ShareBox Data Model & Firestore Schema Reference

## 1. Entity-Relationship Overview

ShareBox utilizes Google Cloud Firestore as a NoSQL document database structured for real-time synchronization, atomic status transitions, and role-based privacy.

```mermaid
erDiagram
    USERS ||--o{ REQUESTS : "creates / helps"
    USERS ||--o{ DAMAGE_REPORTS : "files / responds"
    USERS ||--o{ NOTIFICATIONS : "receives"
    EVENTS ||--o{ REQUESTS : "contains"
    EVENTS ||--o{ EVENT_MEMBERS : "has"
    USERS ||--o{ EVENT_MEMBERS : "joins"
    REQUESTS ||--o{ MESSAGES : "contains"
    REQUESTS ||--o{ CALLS : "initiates"
    REQUESTS ||--o| DAMAGE_REPORTS : "generates"

    USERS {
        string uid PK
        string name
        string email
        string role "member | organizer | admin"
        string status "pending | approved | blocked"
        string department
        string year
        string phone
        string photoURL
        int warningsCount
        timestamp restrictedUntil
        timestamp createdAt
    }

    EVENTS {
        string id PK
        string title
        string description
        string type "Technical | Workshop | Seminar | Competition | Cultural | Other"
        string venue
        string joinCode
        string rules
        string createdBy FK
        boolean isActive
        int memberCount
        timestamp startAt
        timestamp endAt
        timestamp createdAt
    }

    REQUESTS {
        string id PK
        string eventId FK
        string requesterId FK
        string helperId FK
        string itemName
        string category
        string description
        int quantity
        string urgency "Low | Medium | High | Urgent"
        timestamp neededBy
        timestamp expectedReturnAt
        string status "open | accepted | handed_over | returned | completed | cancelled | expired | damage_reported"
        map meetingPoint
        map handoverCondition
        map returnCondition
        timestamp createdAt
        timestamp updatedAt
    }

    MESSAGES {
        string id PK
        string senderId FK
        string text
        string imageURL
        timestamp createdAt
        array seenBy
    }

    CALLS {
        string id PK
        string requestId FK
        string callerId FK
        string calleeId FK
        string status "calling | accepted | rejected | ended"
        map offer
        map answer
        timestamp createdAt
    }

    DAMAGE_REPORTS {
        string id PK
        string requestId FK
        string eventId FK
        string ownerId FK
        string borrowerId FK
        string description
        array photos
        string borrowerResponse
        string status "submitted | under_review | resolved"
        map decision
        timestamp createdAt
    }

    LANDMARKS {
        string id PK
        string name
        string category
        float lat
        float lng
        int order
    }
```

## 2. Collection Schemas

### `users/{uid}`
Stores student, organizer, and administrator profiles.
- **Constraints**:
  - `email` must match the institution domain (`@college.edu`).
  - `status` defaults to `pending` until approved by an administrator.
  - `restrictedUntil` blocks borrowing and lending when in the future.

### `events/{eventId}`
Organized campus events (hackathons, labs, symposiums) and the default `campus-general` community.
- **Rules Text**: Used by organizers/admins to adjudicate damage reports.
- **Join Code**: 6-character code required for private event participation.

### `requests/{requestId}`
Core resource coordination entity with strict state transitions:
1. `open`: Available for acceptance by any event member.
2. `accepted`: Assigned to a helper via atomic Firestore transaction.
3. `handed_over`: Physical possession transferred and verified by both parties.
4. `returned`: Item returned by borrower.
5. `completed`: Confirmed in good condition by lender.
6. `damage_reported`: Lender logged damage or missing equipment.

### `requests/{requestId}/messages/{msgId}`
In-app real-time chat between requester and helper. Subcollection ensures queries are bounded strictly to the relevant exchange.

### `calls/{callId}`
WebRTC signaling document containing SDP offer/answer and subcollections for ICE candidates (`callerCandidates` and `calleeCandidates`).

### `damageReports/{reportId}`
Dispute resolution records capturing photographic evidence, borrower rebuttal, and organizer/admin punitive actions.
