# MRTMIS — Complete Project & Technical Documentation

**Project Title:** Maintenance Request and Tracking Management Information System (MRTMIS)  
**Document Purpose:** Academic, architectural, functional, and operational documentation for system review, grading submission, and deployment.

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [System Objectives & Scope](#2-system-objectives--scope)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [User Roles & Role-Based Access Control (RBAC)](#5-user-roles--role-based-access-control-rbac)
6. [Maintenance Request Lifecycle & State Machine](#6-maintenance-request-lifecycle--state-machine)
7. [Database Schema & Data Model (Cloud Firestore)](#7-database-schema--data-model-cloud-firestore)
8. [Backend REST API Specification](#8-backend-rest-api-specification)
9. [Frontend Application Modules & Routes](#9-frontend-application-modules--routes)
10. [Security & Validation Architecture](#10-security--validation-architecture)
11. [Installation, Configuration & Deployment](#11-installation-configuration--deployment)
12. [Testing, Verification & Presentation Guide](#12-testing-verification--presentation-guide)

---

## 1. Executive Summary & Problem Statement

Organizations, campuses, and institutional facilities frequently rely on ad-hoc communication channels—such as paper forms, emails, spreadsheets, or phone calls—to report equipment faults and facility maintenance issues. These manual workflows result in lost requests, unclear accountability, delayed repairs, no real-time visibility for staff, and zero historical data for management planning.

**MRTMIS (Maintenance Request and Tracking Management Information System)** solves this by providing a centralized, role-based Management Information System where:

- **Staff / Requesters** can log structured maintenance work orders with priority, category, location, and photographic evidence, and monitor resolution progress in real time.
- **Administrators** can triage incoming requests, classify priorities, assign qualified maintenance personnel, manage organizational categories and user accounts, and generate operational analytics and printable/CSV management reports.
- **Maintenance Personnel** receive a scoped operational queue of assigned jobs, record progress transitions (`Assigned` → `In Progress` → `Resolved`), and document technical resolution notes.

Every workflow transition generates an immutable entry in a dedicated audit trail (`status_history`), ensuring full accountability from submission to completion.

---

## 2. System Objectives & Scope

### Core Objectives
1. **Centralized Intake:** Replace informal issue reporting with standardized maintenance request records (`REQ-YYYYMMDD-XXXX`).
2. **Accountable Dispatch:** Link each work order to an administrator assignment record (`ASN-YYYYMMDD-XXXXXX`) and an assigned technician.
3. **Real-Time Tracking:** Synchronize request status changes instantly across browser sessions using Cloud Firestore live listeners (`onSnapshot`).
4. **Role-Based Security:** Enforce strict separation of privileges across `admin`, `staff`, and `maintenance` roles at both the API layer and Firestore Security Rules layer.
5. **Decision Support (MIS Reporting):** Aggregate live operational metrics—resolution rates, category distribution, departmental demand, location hotspots, technician workload, and monthly trends—with CSV export and print-ready PDF formatting.

### Functional Scope
- Authentication via Google Sign-In and Email/Password (with mandatory email verification gate)
- First-time user onboarding (full name and department capture)
- Automated one-time initial administrator bootstrap and default category seeding
- Full CRUD and workflow API backed by Cloud Firestore atomic batch writes
- Image attachment upload and retrieval (`PNG`, `JPEG`, `WebP`, max 2 MB)
- Responsive enterprise dashboard, data tables, slide-over/modal inspection, and printable management reports

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Tailwind CSS v4 | Component architecture, strict typing, enterprise utility styling |
| **Routing & Visualization** | React Router DOM v7, Recharts, Lucide React | Protected client routing, MIS analytics charts, consistent iconography |
| **Backend Server** | Node.js (v22), Express 4, `tsx` | Unified server hosting Vite middleware (dev) / static SPA (`dist/` in prod) and `/api/*` REST routes |
| **Auth Verification** | `jose` (JWKS / JWT verification) | Server-side verification of Firebase ID tokens against Google public JWKS |
| **Database & Auth** | Firebase Authentication, Cloud Firestore | Identity management, real-time `onSnapshot` subscriptions, and persistent document storage |
| **Security & Quality** | Firestore Security Rules, `@firebase/eslint-plugin-security-rules`, TypeScript (`tsc --noEmit`), Vite 8 | Schema-synchronized RBAC enforcement and static type/rule verification |

---

## 4. System Architecture

MRTMIS follows a **hybrid real-time client + verified REST API architecture**:

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (React 19 SPA)                        │
│                                                                      │
│  AuthContext (Firebase Auth SDK) ──► Live Read Listeners (onSnapshot)│
│        │                                       ▲                     │
│        │ Firebase ID Token (Bearer)            │ Real-time updates   │
│        ▼                                       │                     │
│  apiClient (fetch /api/*)                      │                     │
└────────┼───────────────────────────────────────┼─────────────────────┘
         │                                       │
         ▼                                       │
┌────────────────────────────────────────┐       │
│      Express Server (server.ts)        │       │
│  • Serves Vite Dev / Production dist/  │       │
│  • requireAuth (jose JWKS JWT Verify)  │       │
│  • Input Sanitization & State Rules    │       │
│  • Local Attachment Storage (/uploads) │       │
└────────┼───────────────────────────────┘       │
         │ Authenticated Firestore REST API      │
         │ (forwards caller's verified ID token) │
         ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Cloud Firestore + Security Rules                   │
│  • Enforces RBAC, email verification, immutability & field schemas   │
│  • Stores users, requests, categories, assignments, status_history   │
└──────────────────────────────────────────────────────────────────────┘
```

### Architectural Highlights
- **Zero-Trust Token Forwarding:** The Express backend verifies the caller's Firebase ID token using `jose` (`createRemoteJWKSet`) and forwards that same ID token to the Firestore REST API (`server/firestoreRest.ts`). Consequently, **Cloud Firestore Security Rules evaluate every backend write under the true authenticated user's identity**, eliminating privileged service-account bypass risks.
- **Single-Port Full-Stack Serving:** `server.ts` runs on port `3000` in both development (mounting Vite in middleware mode) and production (serving the compiled `dist/` bundle alongside `/api/*`).
- **Atomic Batch Commits:** Multi-document mutations (e.g., creating a request + initial `status_history` entry, or assigning a technician + updating request + creating `assignments` + appending `status_history`) execute via Firestore `commit` batch writes.

---

## 5. User Roles & Role-Based Access Control (RBAC)

MRTMIS supports three operational roles stored in `/users/{userId}` and reinforced via dedicated marker collections (`/admins/{userId}` and `/maintenance_staff/{userId}`):

| Capability / Module | Administrator (`admin`) | Staff / Requester (`staff`) | Maintenance Personnel (`maintenance`) |
| :--- | :---: | :---: | :---: |
| **Sign-in & Profile Onboarding** | Yes | Yes | Yes |
| **Role-Scoped Operational Dashboard (`/dashboard`)** | Organization-wide KPIs & charts | Personal request KPIs & activity | Assigned queue KPIs & priority workload |
| **Submit New Request (`/submit`)** | Yes | Yes | No *(Restricted)* |
| **Edit Pending Request Details** | Any request | Own `Pending` requests only | No |
| **View Requests (`/requests`)** | All organizational requests | Own submitted requests only | Assigned requests only |
| **Inspect Audit History & Notes** | All requests | Own requests | Assigned requests |
| **Assign / Reassign Technicians** | Yes | No | No |
| **Reject Request (with Reason)** | Yes | No | No |
| **Update Progress (`In Progress` / `Resolved`)** | Any valid status | No | Assigned non-terminal requests only |
| **Management Analytics & CSV/PDF Reports (`/reports`)** | Yes | No | No |
| **User Role & Status Management (`/users`)** | Yes *(cannot self-demote/deactivate)* | No | No |
| **Category Taxonomy Management (`/categories`)** | Yes | Read-only (for request creation) | Read-only |
| **Personal Profile Settings (`/profile`)** | Full name & department | Full name & department | Full name & department |

### Role Provisioning Rules
- **Initial Administrator Bootstrap:** The configured `INITIAL_ADMIN_EMAIL` (verified email required) is automatically granted `admin` privileges upon first registration or via `/api/auth/initialize-admin`, creating `/admins/{uid}`, `/system_config/bootstrap`, and seeding the 6 default maintenance categories.
- **Default Registration Role:** All other newly registered users are assigned the `staff` role (`accountStatus: 'active'`).
- **Promotion & Deactivation:** Administrators promote users to `maintenance` or `admin` (or deactivate accounts) via `/users`. Deactivated accounts (`accountStatus === 'inactive'`) are blocked from entering the workspace shell and prevented from submitting or updating requests.

---

## 6. Maintenance Request Lifecycle & State Machine

Every maintenance request progresses through a controlled workflow:

```text
                       ┌───────────────────────────┐
                       │          Pending          │ ◄── Initial state on submission
                       └─────────────┬─────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ Admin Assigns                         │ Admin Rejects
                 ▼                                       ▼
      ┌────────────────────┐                  ┌────────────────────┐
      │      Assigned      │                  │      Rejected      │ (Terminal)
      └─────────┬──────────┘                  └────────────────────┘
                │                                        ▲
                │ Technician starts work                 │ Admin Rejects
                ▼                                        │
      ┌────────────────────┐                             │
      │    In Progress     │─────────────────────────────┘
      └─────────┬──────────┘
                │
                │ Technician / Admin completes repair
                │ (Resolution notes >= 5 chars required)
                ▼
      ┌────────────────────┐
      │      Resolved      │ (Terminal for maintenance staff)
      └────────────────────┘
```

### Transition Enforcement (`server/validation.ts` & `firestore.rules`)
- **Staff (`staff`):** Cannot change request status; may edit title, description, location, priority, or attachment only while status is `Pending`.
- **Maintenance (`maintenance`):**
  - Can transition `Assigned` → `In Progress`
  - Can transition `In Progress` → `In Progress` (progress note update) or `Resolved` (requires `resolutionNotes` ≥ 5 characters)
  - Cannot jump directly from `Assigned` → `Resolved` without starting work (`In Progress`)
  - Cannot modify requests already in `Resolved` or `Rejected` state
- **Administrator (`admin`):** Full override authority to assign, reassign, change priority, update status, or reject requests (rejection requires `rejectionReason` ≥ 5 characters).

---

## 7. Database Schema & Data Model (Cloud Firestore)

All collections and constraints are formally defined in `firebase-blueprint.json` and mirrored in `firestore.rules`.

| Collection Path | Document ID Pattern | Purpose & Key Fields |
| :--- | :--- | :--- |
| `/users/{userId}` | Firebase Auth UID | `userId`, `fullName` (2–100), `email`, `role` (`admin`\|`staff`\|`maintenance`), `department` (2–100), `accountStatus` (`active`\|`inactive`), `createdAt`, `updatedAt` |
| `/admins/{userId}` | Firebase Auth UID | Trusted admin privilege marker (`userId`, `grantedBy`, `createdAt`) |
| `/maintenance_staff/{userId}` | Firebase Auth UID | Trusted technician privilege marker (`userId`, `grantedBy`, `createdAt`) |
| `/categories/{categoryId}` | Slug (e.g. `electrical`) | `categoryId`, `name` (2–80), `description` (≤300), `isActive` (bool), `createdAt`, `updatedAt` |
| `/maintenance_requests/{requestId}` | `REQ-YYYYMMDD-XXXX` | `requestId`, `title` (3–150), `description` (5–2000), `categoryId`, `categoryName`, `location` (2–120), `priority` (`Low`\|`Medium`\|`High`\|`Critical`), `status`, `submittedBy`, `submittedByName`, `submittedByDepartment`, `assignedTo`, `assignedToName`, `assignedAt`, `resolutionNotes`, `rejectionReason`, `attachmentUrl`, `createdAt`, `updatedAt` |
| `/assignments/{assignmentId}` | `ASN-YYYYMMDD-XXXXXX` | `assignmentId`, `requestId`, `assignedTo`, `assignedToName`, `assignedBy`, `assignedByName`, `assignmentNotes`, `assignedAt` |
| `/status_history/{historyId}` | `HIST-YYYYMMDD-XXXXXX` | Immutable audit log: `historyId`, `requestId`, `previousStatus`, `newStatus`, `changedBy`, `changedByName`, `changedByRole`, `requestOwnerId`, `requestAssigneeId`, `comments`, `changedAt` |
| `/system_config/{docId}` | `bootstrap` | One-time initialization lock (`initialized`, `adminUserId`, `createdAt`) |

### Default Seeded Categories (`DEFAULT_CATEGORIES`)
1. `electrical` — Electrical
2. `plumbing` — Plumbing
3. `ict-equipment` — ICT and Computer Equipment
4. `furniture` — Furniture
5. `buildings-facilities` — Buildings and Facilities
6. `other` — Other

---

## 8. Backend REST API Specification

All routes are mounted under `/api` in `server/routes/api.ts`. Authenticated routes require a valid, email-verified Firebase ID Token via `Authorization: Bearer <token>` (or `x-firebase-auth: Bearer <token>`).

| Method & Path | Auth / Role | Description |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Returns service health, `configReady` boolean, and server timestamp |
| `POST /api/uploads` | Verified User | Accepts base64 `dataUrl` (`png`, `jpeg`, `webp`, ≤ 2 MB), saves file to `uploads/`, returns `/api/uploads/:filename` |
| `GET /api/uploads/:filename` | Public (validated filename) | Serves uploaded image attachment (`att_YYYYMMDD_<uuid>.(png\|jpg\|webp)`) |
| `POST /api/auth/register-profile` | Verified User | Creates `/users/{uid}` (idempotent); auto-bootstraps initial admin & default categories if email matches `INITIAL_ADMIN_EMAIL` |
| `POST /api/auth/initialize-admin` | Initial Admin Email | Explicitly initializes or repairs the initial admin profile, marker, bootstrap lock, and default categories (supports optional `ADMIN_BOOTSTRAP_SECRET`) |
| `GET /api/users` | Admin | Lists user profiles with optional `role` and `accountStatus` query filters |
| `PATCH /api/users/:userId` | Owner or Admin | Owner updates `fullName`/`department`; Admin may also update `role` (syncing `/admins` and `/maintenance_staff` markers) and `accountStatus` |
| `GET /api/categories` | Verified User | Lists maintenance categories sorted alphabetically |
| `POST /api/categories` | Admin | Creates a new maintenance category |
| `PATCH /api/categories/:categoryId` | Admin | Updates category `name`, `description`, or `isActive` flag |
| `GET /api/requests` | Role-Scoped | Lists requests scoped by caller role with optional `search`, `categoryId`, `priority`, `status`, `fromDate`, `toDate` filters |
| `POST /api/requests` | Active User | Validates payload, creates request in `Pending` state, and logs initial `None → Pending` `status_history` entry |
| `PATCH /api/requests/:requestId` | Admin or Owner (`Pending`) | Edits `title`, `description`, `location`, or `priority` (Admin priority changes append an audit log entry) |
| `POST /api/requests/:requestId/assign` | Admin | Assigns request to an active `maintenance` or `admin` user, updates priority/status, creates `assignments` & `status_history` records |
| `POST /api/requests/:requestId/reject` | Admin | Rejects non-terminal request with mandatory reason (`≥ 5` chars) and logs `status_history` |
| `POST /api/requests/:requestId/status` | Admin or Assigned Maint. | Executes validated status transition (`In Progress` / `Resolved` / etc.) with `resolutionNotes` and `status_history` audit entry |
| `GET /api/requests/:requestId/history` | Admin, Owner, or Assignee | Returns sorted `status_history` and `assignments` records for a specific request |
| `GET /api/reports/summary` | Admin | Aggregates live KPI totals, category/priority/status/department/location breakdowns, technician workload, and monthly trends (supports `fromDate` & `toDate`) |

---

## 9. Frontend Application Modules & Routes

| Route | Access | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/login` | Public | `AuthPage` | Google Sign-In, Email/Password login & registration, email verification gate, and profile onboarding form |
| `/dashboard` | All Active Roles | `DashboardPage` | Role-specific KPI cards, SLA/priority indicators, interactive Recharts visualizations, and recent activity |
| `/requests` | All Active Roles | `RequestsPage` + `RequestDetailModal` | Searchable, filterable work order registry with detail modal, attachment preview, assignment, status transitions, and audit timeline |
| `/submit` | `admin`, `staff` | `SubmitRequestPage` | Structured maintenance request form with category selection, priority selector, and image attachment upload |
| `/reports` | `admin` | `ReportsPage` | Date-filtered MIS analytics dashboard with CSV export and print-ready PDF report layout |
| `/users` | `admin` | `UsersPage` | Directory of system users with role assignment (`staff` / `maintenance` / `admin`) and active/inactive toggling |
| `/categories` | `admin` | `CategoriesPage` | Create, edit, and activate/deactivate maintenance categories |
| `/profile` | All Active Roles | `ProfilePage` | Self-service updates for display name and department |

### Shared UI & Resilience Components
- `Layout.tsx` — Responsive enterprise shell with grouped sidebar navigation (`Workspace`, `Administration`, `Account`), user role footer, and header account dropdown menu.
- `ErrorBoundary.tsx` — Top-level React error boundary preventing full-page crashes on unexpected runtime or permission errors.
- `ConfirmDialog.tsx` — Accessible confirmation modal for sensitive actions (supports `Escape` and backdrop dismissal).
- `FormControls.tsx` & `StatusBadge.tsx` — Standardized inputs, buttons, KPI cards, and semantic status/priority/account badges.

---

## 10. Security & Validation Architecture

MRTMIS implements **defense-in-depth** across three layers:

1. **Client Validation (`src/utils/validation.ts`):** Prevents invalid lengths, malformed inputs, and oversized attachments (`> 2 MB`) before network calls.
2. **Backend Middleware & Route Guards (`server/authMiddleware.ts`, `server/validation.ts`):**
   - Cryptographically verifies Firebase ID tokens via Google's remote JWKS endpoint (`jwtVerify`).
   - Enforces `email_verified === true` on all protected endpoints.
   - Sanitizes text inputs and enforces `BLUEPRINT_LIMITS` matching `firebase-blueprint.json`.
   - Enforces strict JSON body parsing limits (`4 MB`) and structured `400`/`401`/`403`/`404`/`413` JSON responses.
3. **Cloud Firestore Security Rules (`firestore.rules`):**
   - **Global Default-Deny:** `match /{document=**} { allow read, write: if false; }`
   - **Verified Identity Gate:** Requires `request.auth != null` and `email_verified == true`.
   - **Anti-Update-Gap Schema Validation:** Every write checks `keys().hasAll(...)` and `keys().hasOnly(...)` along with exact string lengths, regex patterns, enums, and `request.time` server timestamps.
   - **PII Isolation:** `/users/{userId}` is readable only by the document owner or a verified Admin.
   - **Immutable Audit Trail:** `/status_history/{historyId}` forbids all updates (`allow update: if false;`).
   - **Static Security Auditing:** Verified against `@firebase/eslint-plugin-security-rules` and documented in `security_spec.md` and `firestore.rules.test.ts`.

---

## 11. Installation, Configuration & Deployment

### Prerequisites
- **Node.js:** v20+ (developed and verified on Node.js v22)
- **Firebase Project:** Configured in `firebase-applet-config.json` with Cloud Firestore and Firebase Authentication enabled

### Environment Variables (`.env.example`)
Copy `.env.example` to `.env` for local execution (never commit `.env` to version control):

| Variable | Description |
| :--- | :--- |
| `APP_URL` | Public URL where the application is hosted |
| `INITIAL_ADMIN_EMAIL` | Verified email address permitted to bootstrap the first Administrator account |
| `ADMIN_BOOTSTRAP_SECRET` | Optional secondary passphrase for `/api/auth/initialize-admin` |
| `GEMINI_API_KEY` | Runtime key (if server-side Gemini capabilities are enabled; not required for core MIS workflows) |

### Local Development & Production Commands
```bash
# 1. Install dependencies
npm install

# 2. Run development server (Express + Vite middleware on port 3000)
npm run dev

# 3. Type-check TypeScript
npm run lint

# 4. Build production frontend bundle into dist/
npm run build

# 5. Start production server (serves dist/ + /api/* on port 3000)
npm run start
```

### Deployment Checklist
1. **Firebase Authorized Domains:** Add your live deployment hostname under **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In popups succeed.
2. **Sign-In Providers:** Ensure **Google** (and optionally **Email/Password**) is enabled under **Firebase Console → Authentication → Sign-in method**.
3. **Deploy Firestore Rules:** Publish `firestore.rules` to your Firestore database instance.
4. **First-Admin Initialization:** Sign in first using the `INITIAL_ADMIN_EMAIL` account to activate Administrator privileges and seed default maintenance categories.
5. **Attachment Persistence Note:** Uploaded images are stored in the server's local `uploads/` directory. On ephemeral container hosts (such as Cloud Run), files in `uploads/` persist for the lifetime of the active container instance; migrating to Cloud Storage is recommended for long-term multi-instance archival.

---

## 12. Testing, Verification & Presentation Guide

### Build & Rule Verification Commands
- **TypeScript Check:** `npm run lint` (`tsc --noEmit`)
- **Production Bundle:** `npm run build` (`vite build`)
- **Security Rules Lint:** `npx eslint firestore.rules`
- **Health Endpoint Check:** `GET /api/health` → returns `{ "status": "ok", "service": "mrtmis-api", "configReady": true }`

### Live Academic Presentation Flow (3-Role Demo)
Prepare three separate browser profiles or incognito sessions representing **Staff**, **Administrator**, and **Maintenance Personnel**:

1. **Staff Submission:** Sign in as `staff` → open **Submit Request** (`/submit`) → log a High/Critical issue with location and photo attachment → verify it appears as `Pending`.
2. **Admin Triage & Assignment:** Sign in as `admin` → inspect the new request in **Requests** (`/requests`) → assign it to a `maintenance` technician with assignment notes → confirm status becomes `Assigned`.
3. **Technician Execution:** Sign in as `maintenance` → view the assigned task in `/dashboard` or `/requests` → transition to `In Progress`, then mark `Resolved` with detailed resolution notes.
4. **Audit & MIS Reporting:** Return to `admin` → open the request's **Status History** timeline showing every logged transition (`None → Pending → Assigned → In Progress → Resolved`) → open **Management Reports** (`/reports`) to demonstrate live KPI charts, CSV export, and Print/PDF generation.
