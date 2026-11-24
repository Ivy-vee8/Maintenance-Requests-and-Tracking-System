# MRTMIS — Maintenance Request & Tracking Management Information System

An enterprise-grade full-stack Management Information System (MIS) for centralized maintenance work order submission, personnel assignment, real-time status tracking, role-based access control (RBAC), and operational analytics.

---

## System Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7, Recharts, Lucide React (`src/`)
- **Backend API:** Node.js + Express (`server.ts`, `server/routes/api.ts`) with JWT Firebase ID Token verification (`server/authMiddleware.ts`) and Firestore REST integration (`server/firestoreRest.ts`)
- **Database & Authentication:** Firebase Authentication + Cloud Firestore (`firebase-applet-config.json`, `firestore.rules`, `firebase-blueprint.json`)

---

## User Roles & Permissions

| Role | Capabilities |
| :--- | :--- |
| **Administrator (`admin`)** | Full visibility across all maintenance requests, technician assignment, priority/status triage, user role & status management (`/users`), category taxonomy management (`/categories`), and management analytics/CSV/PDF reporting (`/reports`). |
| **Staff / Requester (`staff`)** | Submit new maintenance work orders (`/submit`), upload issue images, edit personal requests while `Pending`, and track progress & audit history in real time (`/requests`). Default role assigned on new user registration. |
| **Maintenance Personnel (`maintenance`)** | View assigned work orders (`/dashboard`, `/requests`), update job progress (`Assigned` → `In Progress` → `Resolved`), and post technical resolution notes. Assigned by an Administrator in `/users`. |

---

## Key Features

- **Role-Scoped Dashboards (`/dashboard`):** Live operational KPIs, SLA alerts, category charts, and workload summaries tailored to each role.
- **Work Order Management (`/requests`, `/submit`):** Search, multi-filter table views, modal inspection, image attachment uploads, assignment controls, and full audit trails.
- **Management Reporting (`/reports`):** Date-range filtered analytics with live KPI aggregation, CSV export, and print-ready PDF report layout.
- **Strict Security & Validation:** Schema-backed Firestore security rules (`firestore.rules`), server-side token verification, role guards on protected routes, and React `ErrorBoundary` resilience.

---

## Full Documentation & Academic Deliverables

- **`docs/DOCUMENTATION.md`** — Complete project documentation (architecture, RBAC matrix, request lifecycle state machine, Firestore data model, REST API reference, security architecture, and demo guide)
- `firebase-blueprint.json` — Formal entity & JSON Schema data model specification
- `firestore.rules` — Production Firestore RBAC & payload validation rules
- `firestore.rules.test.ts` & `security_spec.md` — Security rule verification suite & specification
- `.env.example` — Non-secret environment variable template

---

## Local Setup & Production Commands

### 1. Prerequisites
- Node.js 20+ (tested on Node.js 22)
- A configured Firebase project (`firebase-applet-config.json`) with Firestore and Authentication enabled

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (never commit `.env` to source control) and set values as needed:
```bash
cp .env.example .env
```

### 4. Run Development Server
```bash
npm run dev
```
The server starts on `http://localhost:3000`.

### 5. Production Build & Start
```bash
npm run build
npm run start
```
`npm run build` compiles the React application into `dist/`, and `npm run start` serves both the Express `/api/*` endpoints and the compiled SPA on port `3000`.

---

## Deployment & Live Presentation Notes

1. **Authorized Domains:** Ensure your live hosting domain is added under **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In works for all users.
2. **Sign-In Methods:** Keep **Google** enabled (and optionally enable **Email/Password**) under **Firebase Console → Authentication → Sign-in method**.
3. **Initial Admin Setup:** Sign in first with the configured `INITIAL_ADMIN_EMAIL` account to activate Administrator privileges and seed default maintenance categories.
4. **Demo Accounts:** Use separate browser profiles or incognito windows with distinct accounts for **Admin**, **Staff**, and **Maintenance Personnel** to demonstrate the end-to-end maintenance workflow during presentation.
