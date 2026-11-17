# Firestore Security Specification — 업무일지 (Work Log)

## 1. Data Invariants
1. Every document in `/users/{userId}` and its subcollections (`companies`, `projects`, `tags`, `dailyLogs`, `monthlyReviews`, `careerReports`) belongs strictly to the authenticated, email-verified user matching `{userId}` and `data.userId == request.auth.uid`.
2. Document IDs (`userId`, `companyId`, `projectId`, `tagId`, `logId`, `reviewId`, `reportId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
3. No unverified email users or unauthenticated users can read or write any document.
4. No shadow/ghost fields are allowed on create (`keys().hasAll(...) && keys().hasOnly(...)`) or update (`affectedKeys().hasOnly(...)`).
5. `userId` and `createdAt` are immutable once created. `createdAt == request.time` on create, `updatedAt == request.time` on create and update.
6. All string fields enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
7. All array fields (`milestones`, `tagIds`, `keyAchievements`, `dedupedExperiences`, `resumeSections`, `interviewQuestions`) enforce strict `.size()` upper bounds and element type guards.
8. Every `allow list` rule evaluates `existing().userId == request.auth.uid` without `get()` or `exists()` lookups.
9. Subcollection creates verify that `/users/{userId}` parent document exists (`exists(...)`), enforcing the Master Gate invariant.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Unauthenticated user reading `/users/userA/companies/comp1`.
2. **Cross-Tenant Read**: Authenticated `userB` attempting `get` or `list` on `/users/userA/dailyLogs`.
3. **Identity Spoofing on Create**: `userA` creating `/users/userA/companies/comp1` with `userId: "userB"`.
4. **Shadow/Ghost Field Injection**: `userA` creating `/users/userA/tags/tag1` with extra `isAdmin: true` field.
5. **Unverified Email Write**: Authenticated user with `email_verified: false` creating a `Company` document.
6. **ID Poisoning**: `userA` creating `/users/userA/projects/bad$id..with/chars` or >128 char ID.
7. **Immortal Field Mutation**: `userA` updating `/users/userA/companies/comp1` attempting to alter `userId` or `createdAt`.
8. **Client-Forged Timestamp**: `userA` creating `/users/userA/dailyLogs/log1` with a past `createdAt` instead of `request.time`.
9. **Oversized String DoW Attack**: `userA` writing `coreTask` with 5,000 characters (>300 maxLength).
10. **Unbounded Array Overflow**: `userA` creating a `DailyLog` with 20 `tagIds` (>15 limit) or `Project` with 40 `milestones` (>30 limit).
11. **Array Type Poisoning**: `userA` creating a `DailyLog` with `tagIds: [12345]` instead of strings.
12. **Orphan Subcollection Write**: `userA` creating `/users/userA/companies/comp1` before `/users/userA` workspace document exists.
