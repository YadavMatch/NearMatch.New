# NearMatch Firebase Security Specification

## 1. Core Data Invariants
1. **PII Isolation**: Email addresses, exact dates of birth, and discovery filter bounds MUST live strictly inside `/profiles/{userId}/private/info` and are readable/writable only by `request.auth.uid == userId`. `/profiles/{userId}` holds only public card fields and ~300m snapped coordinates.
2. **Verified Identity**: Every write operation and private read MUST require `request.auth != null && request.auth.token.email_verified == true`.
3. **Self-Moderation Lock**: Clients can never set `isBanned: true` or clear an existing ban (`isBanned` must be `false` on creation and immutable on profile updates). Clients cannot reopen a deleted profile (`isDeleted == true` is terminal).
4. **Adult Age Gate**: Public `age` MUST be an integer between `18` and `99`. Private `dob` MUST match `YYYY-MM-DD`.
5. **Hidden Incoming Likes**: Users may only `list` their own outgoing swipes (`actorId == uid()`). A target user cannot read an incoming swipe unless they have already created a reciprocal `like`/`superlike` swipe.
6. **Atomic Reciprocal Matches**: A `/matches/{low_high}` document may only be created when `userLow < userHigh`, the creator is one of the two participants, neither user has blocked the other, and BOTH reciprocal `like`/`superlike` swipe documents exist (`getAfter`).
7. **Master Gate on Messages**: Messages inside `/matches/{matchId}/messages/{messageId}` require reading the parent match via `get()`/`getAfter()`, verifying participant membership, verifying `isActive == true` on create, and verifying neither participant blocked the other. Only the recipient may update `readAt`.
8. **Terminal State Locking**: Once `/matches/{matchId}.isActive` becomes `false` (unmatched/blocked), no further updates to the match or new messages inside it are permitted.
9. **Size & Array Bounds**: Every string has an explicit `.size()` ceiling, every array has a bounded `.size()`, and every path/foreign-key ID matches `^[a-zA-Z0-9_\-]+$` with length `<= 128` (or `<= 260` for composite `matchId`).
10. **Temporal Integrity**: Creation timestamps (`createdAt`, `matchedAt`, `sentAt`) MUST equal `request.time` and remain immutable; update timestamps (`updatedAt`, `readAt`, `lastMessageAt`) MUST equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Profile**: Creating `/profiles/victim_uid` while signed in as `attacker_uid` (fails `isOwner(userId)` & `uid == uid()`).
2. **Unverified Email Bypass**: Attempting any write with `email_verified: false` (fails `isVerified()`).
3. **Shadow Ghost Field Injection**: Creating/updating `/profiles/{uid}` with extra field `isAdmin: true` or `verifiedBadge: true` (fails `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)`).
4. **Ban Tampering / Self-Unban**: Updating `/profiles/{uid}` to flip `isBanned: false` when `existing().isBanned == true` or setting `isBanned: true` directly (fails `isBanned == false` & `affectedKeys` allowlist).
5. **Underage Profile Bypass**: Creating `/profiles/{uid}` with `age: 16` (fails `age >= 18`).
6. **Incoming Likes Scraping**: Listing `/swipes` without `actorId == uid()` or attempting `get` on another user's unidirectional swipe targeting `uid()` before liking back (fails `allow list` & `allow get`).
7. **Unilateral Match Forgery**: Creating `/matches/attacker_victim` without an existing `like`/`superlike` swipe from `victim` (fails `getAfter` reciprocal check).
8. **Blocked User Match / Message**: Creating a swipe, match, or message while a `/blocks/{a}_{b}` document exists in either direction (fails `!exists(block)` check).
9. **Sender Impersonation & Match Reopen**: Sending a message in `/matches/{id}/messages` with `senderId != uid()`, or posting to an inactive (`isActive: false`) match, or updating `isActive: true` on an unmatched thread (fails sender check + Master Gate + terminal state lock).
10. **Message Body Tampering via Read Receipt**: Sender or recipient updating `body` along with `readAt` on an existing message (fails `affectedKeys().hasOnly(['readAt'])` and `recipientId == uid()`).
11. **PII Leak Attempt**: Signed-in user attempting `get` on `/profiles/other_uid/private/info` (fails `isOwner(userId)`).
12. **Resource Exhaustion / ID Poisoning**: Creating a document with a 2,000-character ID or a 5,000-character bio or 50 interests (fails `isValidId()` and strict `.size()` bounds).
