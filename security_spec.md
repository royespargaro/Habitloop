# Security Specification: InPursuit

## 1. Data Invariants
1. **User Data Isolation**: Only the authenticated user whose `request.auth.uid == userId` may `get`, `create`, `update`, or `delete` `/users/{userId}`. Collection listing (`allow list`) on `/users` is strictly disabled (`if false`).
2. **Verified Identity**: All writes (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
3. **Path Integrity**: `{userId}` MUST satisfy `isValidId(userId)` (`<= 128` chars matching `^[a-zA-Z0-9_-]+$`).
4. **Strict Schema Enforcement**: Every write to `/users/{userId}` MUST satisfy `isValidUserWorkspace(incoming())` (exact required keys, exact allowed keys via `hasOnly`, `schemaVersion == 3`, `list` types with bounded sizes, non-empty element map checks, and `updatedAt` string <= 40 chars).
5. **Default Deny**: All other Firestore paths are denied via `match /{document=**} { allow read, write: if false; }`.

## 2. Adversarial Payloads Blocked by Rules
1. **Cross-User Get**: Authenticated user `userA` attempts `get(/users/userB)` -> `PERMISSION_DENIED`.
2. **Collection Enumeration**: Authenticated user attempts `list(/users)` -> `PERMISSION_DENIED`.
3. **Cross-User Write**: Authenticated user `userA` attempts `setDoc(/users/userB, ...)` -> `PERMISSION_DENIED`.
4. **Unauthenticated Access**: Anonymous/signed-out client attempts read or write -> `PERMISSION_DENIED`.
5. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts write -> `PERMISSION_DENIED`.
6. **Ghost / Shadow Field Injection**: Write payload containing `role: "admin"` or `isAdmin: true` -> rejected by `hasOnly(allowedKeys)`.
7. **Missing Required Field**: Write payload missing `dailyReviews` or `habits` -> rejected by `hasAll(reqKeys)`.
8. **Invalid Schema Version**: Write payload with `schemaVersion: 2` or `schemaVersion: "3"` -> rejected by `schemaVersion is int && schemaVersion == 3`.
9. **Array Type Spoofing**: Write payload where `tasks` is a string/map or `tasks[0]` is a primitive instead of a map -> rejected by `isBoundedMapList`.
10. **Denial-of-Wallet Oversized List**: Write payload with `tasks.size() > 1000` or `goals.size() > 200` -> rejected by bounded size checks.
11. **Malformed Timestamp Overflow**: Write payload with `updatedAt` longer than 40 characters or non-string -> rejected.
12. **Legacy / Arbitrary Subcollection Write**: Attempt to write `/users/{userId}/habits/h1` or `/other/doc` -> rejected by default deny catch-all.
