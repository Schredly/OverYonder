# Change Tracking

This file tracks all changes made to the codebase. Each entry includes a sequential number, timestamp, and detailed summary suitable for syncing context with GPT.

---

## #001 — 2026-03-01 — Initial Project Setup

**What happened:**
- Created the project repository at `context-agents/context-agents/`.
- Added the `ai-context/` folder containing 13 architecture and planning documents (00_README through 12_GPT_CONTEXT_WINDOW) that define the Simplified MVP for the Self-Correcting Agentic System.
- Extracted the UI source code from a zip file into `src/`.

**Current project structure:**
```
context-agents/
├── ai-context/               # 13 planning/architecture docs
│   ├── 00_README.md
│   ├── 01_MVP_PRODUCT_SPEC.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_DATA_MODEL.md
│   ├── 04_WIZARD_UI.md
│   ├── 05_SERVICE_NOW_INTEGRATION.md
│   ├── 06_GOOGLE_DRIVE_SCAFFOLDING.md
│   ├── 07_AGENT_ORCHESTRATION.md
│   ├── 08_PROMPTING_AND_ROUTING.md
│   ├── 09_EVALUATION_AND_FEEDBACK.md
│   ├── 10_SPRINT_PLAN.md
│   ├── 11_CLAUDE_GROUND_RULES.md
│   └── 12_GPT_CONTEXT_WINDOW.md
├── src/
│   ├── app/
│   │   ├── App.tsx                      # Root component, renders RouterProvider
│   │   ├── routes.tsx                   # React Router config: /tenants, /tenants/setup, /tenants/setup/:id, /runs, /settings
│   │   ├── components/
│   │   │   ├── Sidebar.tsx              # Left nav: Tenants, Runs, Settings (disabled)
│   │   │   ├── TopBar.tsx               # Top bar with tenant selector dropdown + status badge
│   │   │   ├── SetupStepper.tsx         # Vertical stepper component for wizard steps
│   │   │   ├── figma/
│   │   │   │   └── ImageWithFallback.tsx
│   │   │   └── ui/                      # ~40 shadcn/ui components (button, card, dialog, table, tabs, select, etc.)
│   │   ├── data/
│   │   │   └── mockData.ts             # TypeScript interfaces + mock data for Tenant, Run, Skill, RunResult
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx      # Shell: Sidebar + TopBar + <Outlet />
│   │   └── pages/
│   │       ├── TenantsPage.tsx          # Tenant list table with create/delete/open-setup actions
│   │       ├── SetupWizardPage.tsx      # 6-step wizard: Create Tenant → ServiceNow → Schema → Drive → Scaffold → Activate
│   │       └── RunsPage.tsx             # Split-pane: run list (left) + run detail with skills timeline + result panel (right)
│   └── styles/
│       ├── index.css                    # Imports fonts, tailwind, theme
│       ├── tailwind.css                 # Tailwind v4 config with tw-animate-css
│       ├── theme.css                    # CSS custom properties for light/dark themes, base typography
│       └── fonts.css                    # Empty (placeholder)
└── CHANGE-TRACKING.md                   # This file
```

**Key technical details:**
- **Framework:** React with React Router (v7 style — `createBrowserRouter`, `RouterProvider`)
- **Styling:** Tailwind CSS v4 + shadcn/ui component library (Radix primitives)
- **State:** Local React state + module-level mock data (no state management library yet)
- **Mock data:** 3 tenants (Acme Corp/Active, TechStart Inc/Active, Global Dynamics/Draft), 3 runs with skill chains (Validate → Retrieve Docs → Synthesize → Writeback → Record Outcome)
- **No backend yet** — all data is hardcoded in `mockData.ts`
- **No build tooling configured yet** — no package.json, vite config, or tsconfig in the repo

**What GPT should know for next steps:**
- The UI skeleton matches Sprint 1 from `10_SPRINT_PLAN.md`: Tenants list, Setup Wizard, Runs Console
- The wizard has 6 steps matching `04_WIZARD_UI.md`: Create Tenant → Configure ServiceNow → Classification Schema → Google Drive → Scaffold Drive → Activate
- The runs page shows the skill chain from `07_AGENT_ORCHESTRATION.md` with expandable reasoning per skill
- All pages currently use mock data — the next major milestone is wiring to a FastAPI backend
- The TopBar tenant selector uses `window.location.reload()` for tenant switching (will need proper state management)
- No build infrastructure exists yet (needs package.json, vite/next config, tsconfig)

---

## #002 — 2026-03-02 — Real Google Drive Integration

**What happened:**
Replaced the mock Google Drive integration in the Setup Wizard with a fully functional Google OAuth + Drive API implementation. The wizard now authenticates users via Google, verifies Drive folder access, and creates a real recursive folder scaffold in Google Drive. Also replaced the flat classification schema with a hierarchical tree editor supporting up to 4 levels of nesting.

**New files created:**

- `src/app/auth/gis.d.ts` — TypeScript type declarations for the Google Identity Services (GIS) library. Declares the `google.accounts.oauth2` global namespace including `TokenClientConfig`, `TokenResponse`, `TokenClient`, `initTokenClient()`, and `revoke()`.

- `src/app/auth/google-auth.ts` — Low-level wrapper around the GIS token client. Manages module-level state (`accessToken`, `expiresAt`, `tokenClient`). Exports `initGoogleAuth(clientId)`, `requestAccessToken()` (wraps the callback-based GIS popup in a Promise), `getAccessToken()` (returns token if valid, null if expired), and `signOut()` (revokes token). Scope: `drive openid email`. No npm packages — uses the GIS script loaded in index.html. Token is in-memory only (no localStorage).

- `src/app/auth/GoogleAuthContext.tsx` — React context + provider that wraps the app. Exposes `isAuthenticated`, `accessToken`, `userEmail`, `signIn()`, `signOut()`, `isInitialized`, `initError`, `configureClientId()`, and `needsClientId`. On mount, waits for the GIS script to load, then initializes with the client ID from `VITE_GOOGLE_CLIENT_ID` env var. If the env var is missing, `needsClientId` is set to `true` so the UI can show a manual client ID input field. The `configureClientId()` method allows entering the client ID at runtime via the browser UI. Uses `AbortController` for proper cleanup on unmount (important for React StrictMode). The `useGoogleAuth()` hook returns a safe fallback object instead of throwing if the provider is missing — this prevents app crashes.

- `src/app/services/google-drive.ts` — Fetch-based Drive API service with no npm dependencies. Exports:
  - `testDriveFolder(accessToken, folderId)` — GET `/drive/v3/files/{folderId}`, verifies it's a folder, returns the folder name
  - `ensureFolder(accessToken, name, parentId)` — Idempotent: searches by name+parent, creates if missing. Returns `{ id, name, created }`
  - `scaffoldDrive(accessToken, rootFolderId, tenantId, classificationNodes, onProgress)` — Creates the full recursive tree: `rootFolder/AgenticKnowledge/{tenantId}/_schema/`, `dimensions/{recursive classification tree}/`, `documents/`
  - `uploadSchemaFile(accessToken, schemaFolderId, schema)` — Uploads `classification_schema.json` to `_schema/`, updates if it already exists
  - All calls include `supportsAllDrives=true` for Shared Drive compatibility

**Files modified:**

- `index.html` — Added `<script src="https://accounts.google.com/gsi/client" async defer></script>` before the app script tag.

- `src/app/App.tsx` — Wrapped `<RouterProvider>` with `<GoogleAuthProvider>` so all routes have auth access.

- `src/app/layouts/DashboardLayout.tsx` — Added `<Toaster />` from the sonner UI component so toast notifications work throughout the app.

- `src/app/data/mockData.ts` — Added `ClassificationNode` interface (`{ name: string; children: ClassificationNode[] }`). Changed `Tenant.classificationSchema` from `ClassificationLevel[]` to `ClassificationNode[]` to support hierarchical classification. Extended `Tenant.googleDrive` with optional `folderName` and `scaffolded` fields. Updated mock data for Acme Corp to use the tree structure.

- `src/app/pages/SetupWizardPage.tsx` — Major rewrite:
  - **Step 3 (Classification Schema):** Replaced the flat table (levelKey/displayName/required columns) with a recursive `TreeEditor` component. Users can add categories, nest children up to 4 levels deep, and delete nodes. Each node has a name input, an add-child button (blue +), and a delete button (red trash).
  - **Step 4 (Configure Google Drive):** When no `VITE_GOOGLE_CLIENT_ID` env var is set, shows a text input where the user can paste their Google Cloud OAuth Client ID directly in the browser. After connecting, shows "Sign in with Google" button. After auth, shows the signed-in email with sign-out option, folder ID input, and a real "Test Connection" button that calls the Drive API and displays the resolved folder name.
  - **Step 5 (Scaffold Drive):** Shows a full recursive tree preview of the folder structure that will be created. "Apply Scaffold" button calls `scaffoldDrive()` with a progress callback showing real-time progress bar as each folder is created/found. Also uploads `classification_schema.json`. Shows success/error state.
  - **Step 6 (Activate):** Summary now shows verified folder name and scaffold status.

- `.gitignore` — Added `.env` and `.env.local`.

**Key architecture decisions:**
- **No npm packages for Google auth** — GIS loaded as a script tag, Drive API called via fetch
- **Token in memory only** — no localStorage, user re-authenticates on refresh
- **`drive` scope (not `drive.file`)** — needed to read arbitrary folders the user didn't create via the app
- **Idempotent scaffold** — `ensureFolder` searches before creating, safe to run repeatedly
- **Runtime client ID input** — users can enter their OAuth client ID in the browser UI without needing a `.env` file
- **Graceful degradation** — `useGoogleAuth()` returns a safe fallback instead of throwing, preventing app crashes when auth isn't configured
- **Recursive classification tree** — `ClassificationNode` supports arbitrary nesting up to 4 levels, replacing the flat `ClassificationLevel` model

**Setup requirements for Google Drive integration:**
1. Google Cloud project with OAuth 2.0 Client ID (Web application type)
2. Drive API enabled on the project
3. `http://localhost:5173` in both Authorized JavaScript origins AND Authorized redirect URIs
4. Either `VITE_GOOGLE_CLIENT_ID` in `.env` or enter the client ID in the browser UI at runtime

**What GPT should know for next steps:**
- Google OAuth + Drive API is fully working end-to-end (tested with real Google account and real Drive folder)
- The `ClassificationLevel` interface still exists in mockData.ts but is no longer used by the Tenant type — it's replaced by `ClassificationNode`
- The scaffold creates: `rootFolder/AgenticKnowledge/{tenantId}/_schema/`, `dimensions/{tree}/`, `documents/`
- `classification_schema.json` is uploaded to `_schema/` containing the full tree structure
- All data is still in-memory mock data — no backend persistence yet
- The `sonner` toast system is now mounted and available app-wide via `<Toaster />` in DashboardLayout

---

*Next change will be #003.*
