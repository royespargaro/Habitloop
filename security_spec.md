# Security Specification: HabitLoop

## 1. Data Invariants
1. **User Data Isolation**: Every document path within `/users/{userId}/` MUST match the `request.auth.uid` of the authenticated user.
2. **Path Integrity**: Path variables (e.g., `{userId}`, `{habitId}`, `{monthKey}`) MUST be validated to match the expected format (e.g., `isValidId()`).
3. **Write Integrity**: Only the owner of a document can create, update, or delete it.
4. **Schema Enforcement**: All document writes MUST match the schema defined in `firebase-blueprint.json` (keys, types, constraints).
5. **PII Isolation**: (Future) User profile information in `/users/{userId}` is readable only by the owner.

## 2. The "Dirty Dozen" Payloads (Examples)
1. **Cross-User Read**: Authenticated user 'A' attempts to `get()` path `/users/userB/habits/habit1`.
2. **Cross-User Write**: Authenticated user 'A' attempts to `setDoc()` path `/users/userB/habits/habit1`.
3. **Invalid ID Poisoning**: Attempt to write a habit with ID `../../../../poison`.
4. **Schema Violation (Missing Required)**: Write a `Habit` document missing the `userId` field.
5. **Schema Violation (Invalid Type)**: Write a `HabitCheck` where `days` is a string instead of an array.
6. **Schema Violation (Excess Fields)**: Write a `Habit` with a `ghostField: true`.
7. **Unauthorized Write**: Unauthenticated user attempts to write to `/users/userA/...`.
8. **Invalid Month Key**: Write a `HabitCheck` with `monthKey: "2026-13"` (invalid month).
9. **String Overflow**: Write a habit name with > 40 characters.
10. **Modification of System Fields**: Attempt to update `habitId` of an existing `HabitCheck`.
11. **Orphaned Write**: Create a `HabitCheck` with a `userId` that does not match the parent document's path.
12. **Anonymous Write**: Authenticated user with `email_verified: false` attempts to write (if enforcement is required).

## 3. Security Rules Test Runner (firestore.rules.test.ts)
(To be implemented using `@firebase/rules-unit-testing`)
- Setup: Use `initializeTestEnvironment` with a mock Firestore.
- Tests: Assert `PERMISSION_DENIED` for all Dirty Dozen payloads.
