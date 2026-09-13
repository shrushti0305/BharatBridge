# Security Specification - Bharat Bridge

## Data Invariants
- A `Message` cannot exist without a valid `Session`.
- Only the `speakerId` of a session (or an admin) can add messages to that session.
- A session marked as `finished` cannot receive new messages.
- Users can only read sessions they are part of (for now, let's keep it simple: if you have the session ID, you can join/listen).
- Admins can read all sessions and messages.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a session with a different `speakerId` than the authenticated user.
2. **State Shortcutting**: Attempt to create a message in a `finished` session.
3. **Resource Poisoning**: No explicit size limit on `originalText` or `translatedText` beyond Firestore's 1MB limit.
4. **ID Poisoning**: Session ID with invalid characters.
5. **PII Leak**: (N/A for this app)
6. **Unauthorized Write**: User A attempts to write a message to User B's session.
7. **Bypassing validation**: Missing `timestamp` in message.
8. **Invalid Status**: Setting session status to something other than `active` or `finished`.
9. **Timestamp Spoofing**: Client sending a past timestamp instead of `request.time`.
10. **Ghost Fields**: Adding `isAdmin: true` to a session document.
11. **Admin Spoofing**: Regular user attempting to access the admin collection (if it existed) or perform admin-only list.
12. **Metadata Tampering**: Changing `createdAt` of a session after creation.

## Test Plan
- Verify `create` on `/sessions` requires `speakerId == request.auth.uid`.
- Verify `create` on `/sessions/{sessionId}/messages` requires session status == `active`.
- Verify `update` on session `status` only allowed for speaker.
- Verify `read` access for admins on all collections.
