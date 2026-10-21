# BharatBridge v4.2 — Role Transition & State Machine Specification

## 1. Role Model Overview
BharatBridge defines 3 distinct, server-authoritative participant roles:
- **ORGANIZER**: Session host/creator who controls session lifecycle, monitors panelist slots, and approves/rejects speech requests.
- **PANELIST**: Authenticated speaker assigned a specific `speakerId` (`speaker-01` through `speaker-10`) who can broadcast microphone audio and Speech-to-Text streams.
- **LISTENER**: Room participant who consumes real-time translated captions and synthesized audio in their selected target language.

```
                  ┌──────────────────────────────────────────────────────────┐
                  │                                                          │
                  ▼                                                          │ (De-allocate slot)
           ┌──────────────┐      speaker_request       ┌──────────────────┐   │
           │   LISTENER   ├──────────────────────────►│ REQUEST_PENDING  │   │
           └──────┬───────┘                           └────────┬─────────┘   │
                  ▲                                            │             │
                  │                                   speaker_approval       │
                  │                                   (Capacity < 10)        │
                  │                                            │             │
                  │                                            ▼             │
                  │       switch_to_listener            ┌──────────────┐     │
                  └─────────────────────────────────────┤   PANELIST   ├─────┘
                                                        └──────────────┘
```

---

## 2. Server-Authoritative Security Contract
1. **Zero Frontend Privilege Self-Declaration**: The client browser cannot unilaterally declare `role = "PANELIST"` or `role = "ORGANIZER"`.
2. **Server-Side Authorization**:
   - `server.ts` maintains session state including `organizerId`, `panelists` Map (up to 10 slots), and `pendingRequests` Map.
   - All role state transitions require backend validation and emit `{ type: "role_changed", role: "PANELIST" | "LISTENER", ... }`.

---

## 3. WebSocket Handshake Protocol

### A. Listener Request to Speak (`speaker_request`)
```json
{
  "type": "speaker_request",
  "sessionId": "582941",
  "userId": "usr_948201",
  "userName": "Rahul",
  "targetLang": "hi"
}
```
**Server Action**:
- Validates current active panelist count (`< 10`).
- Adds user to `pendingRequests` Map.
- Responds to listener with `{ type: "speaker_request_status", status: "pending" }`.
- Emits updated `room_state` payload to Organizer and Room clients.

### B. Organizer Approval / Rejection (`speaker_approval`)
```json
{
  "type": "speaker_approval",
  "sessionId": "582941",
  "targetUserId": "usr_948201",
  "approved": true
}
```
**Server Action**:
- If `approved: false`, server notifies target socket with `{ type: "role_changed", role: "LISTENER", status: "rejected" }`.
- If `approved: true`, server checks `panelists.size < 10`.
  - If capacity full ($\ge 10$), returns `{ type: "role_changed", role: "LISTENER", status: "limit_reached" }`.
  - If capacity available, assigns lowest free slot (e.g., `speaker-02`), updates socket role to `PANELIST`, and emits `{ type: "role_changed", role: "PANELIST", speakerId: "speaker-02" }`.

### C. Panelist to Listener Transition (`switch_to_listener`)
```json
{
  "type": "switch_to_listener",
  "sessionId": "582941"
}
```
**Server Action**:
- De-allocates speaker slot from `panelists` Map (making it available for future requests).
- Updates socket role to `LISTENER`.
- Returns `{ type: "role_changed", role: "LISTENER", status: "switched" }`.
- Emits updated `room_state` to all room clients.

---

## 4. 10-Panelist Slot Management
- **Slots**: `speaker-01` through `speaker-10`.
- **Host Auto-Assignment**: Room creator/organizer automatically receives `speaker-01`.
- **Slot Recycling**: When a panelist switches back to Listener mode or leaves the room, their slot (e.g. `speaker-03`) is recycled and becomes available for the next approved request.
