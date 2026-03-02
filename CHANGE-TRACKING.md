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

*Next change will be #002.*
