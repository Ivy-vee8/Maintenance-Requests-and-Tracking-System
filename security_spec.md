# MRTMIS Security Specification & Adversarial Test Matrix

## 1. Core Data Invariants

1. **Identity Integrity & No Self-Escalation**:
   - Ordinary users registering in `/users/{userId}` MUST have `role == 'staff'` and `accountStatus == 'active'`.
   - Only verified administrators (`/admins/{uid}` or bootstrapped admin email with `email_verified == true`) can grant `/admins/{uid}`, `/maintenance_staff/{uid}`, or elevate a user's `role` / `accountStatus`.
2. **PII Isolation**:
   - `/users/{userId}` contains `email`. Read (`get` / `list`) access is strictly restricted to `isOwner(userId)` or `isAdmin()`. No blanket `isSignedIn()` reads exist.
3. **Request Lifecycle & Ownership Integrity**:
   - Newly created `/maintenance_requests/{requestId}` MUST have `submittedBy == request.auth.uid`, `status == 'Pending'`, `assignedTo == ''`, and a valid existing `categoryId` in `/categories`.
   - Requesters can only read/list requests where `submittedBy == request.auth.uid`, and can only edit non-workflow fields while `status == 'Pending'`.
   - Maintenance personnel can only read/list requests where `assignedTo == request.auth.uid`, and can only transition `Assigned -> In Progress -> Resolved` with `resolutionNotes` and `updatedAt`.
   - Terminal states (`Resolved`, `Rejected`) are locked against modification by non-admins.
4. **Temporal Integrity**:
   - Every `create` enforces `createdAt == request.time` (or `assignedAt`/`changedAt == request.time`).
   - Every `update` enforces `createdAt == existing().createdAt` and `updatedAt == request.time`.
5. **Audit Log Immutability & Atomicity**:
   - `/status_history/{historyId}` and `/assignments/{assignmentId}` require `existsAfter(/databases/.../maintenance_requests/$(requestId))` on create.
   - `/status_history/{historyId}` is strictly immutable (`allow update: if false`).
6. **Path & Payload Hardening**:
   - Every single-document operation enforces `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
   - Every string field enforces strict `.size()` upper bounds; `keys().hasOnly(...)` rejects all shadow/ghost fields.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Expected Result |
|---|---|---|---|
| 1 | Self-assign `role: "admin"` during user registration | `POST /users/{uid}` | `PERMISSION_DENIED` |
| 2 | Shadow field injection (`isVerified: true`) on request creation | `POST /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 3 | Unverified email (`email_verified: false`) impersonating admin email | `GET /users/{otherUid}` | `PERMISSION_DENIED` |
| 4 | Staff reading another employee's `/users/{otherUid}` PII document | `GET /users/{otherUid}` | `PERMISSION_DENIED` |
| 5 | Staff creating a request pre-set to `status: "Resolved"` or `submittedBy: "other"` | `POST /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 6 | Client forging backdated `createdAt` instead of `request.time` | `POST /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 7 | Maintenance user updating an unassigned request (`assignedTo != uid`) | `PATCH /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 8 | Maintenance user modifying `priority` or `submittedBy` on assigned task | `PATCH /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 9 | Re-opening a terminal `Resolved` request as non-admin | `PATCH /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 10 | Oversized 1MB string resource-poisoning in `title` or document ID | `POST /maintenance_requests/{longId}` | `PERMISSION_DENIED` |
| 11 | Creating a request referencing a non-existent `categoryId` | `POST /maintenance_requests/{id}` | `PERMISSION_DENIED` |
| 12 | Mutating or tampering with an existing `/status_history/{id}` audit entry | `PATCH /status_history/{id}` | `PERMISSION_DENIED` |
