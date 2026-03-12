# Wizard UI — OverYonder.ai Platform

## Two wizard flows

### 1. Tenant Setup Wizard (`/tenants/create` and `/tenants/:id`)
Enforces the correct onboarding order for new tenants.

**Step order (4 steps):**
1. **Tenant Details** — name, tenant ID, status (Draft/Active)
2. **Integrations** — add/remove platform connections from the integration catalog; configure each
3. **Use Cases** — attach use cases to the tenant; create new ones if needed
4. **Summary** — review configuration; activate tenant

### 2. Genome Capture Wizard (`/genomes/capture`)
Guides the user through extracting an application genome from a source platform.

**Step order (5 steps):**
1. **Source Platform** — select from ServiceNow, Salesforce, Jira, Zendesk, Workday (icon cards with selection state)
2. **Application Type** — select: Catalog Item, Workflow, Table Application, or Custom App (description cards)
3. **Configure Extraction** — instance URL, API credentials, application name, application category
4. **Preview** — 2×2 grid showing extracted genome document: Objects, Workflows, Fields, Relationships (color-coded cards per category)
5. **Confirm Capture** — summary of all selections and detected counts; "Capture Genome" button navigates to `/genomes`

## Design patterns (shared)
- **Stepper indicator:** Numbered circles (w-8 h-8 rounded-full border-2) with:
  - Current step: `bg-gray-900 border-gray-900 text-white`
  - Completed step: `bg-green-500 border-green-500 text-white` with Check icon
  - Future step: `border-gray-300 text-gray-400`
  - Connector lines: `h-0.5 mx-4`, green when completed, gray-200 when not
- **Form container:** `bg-white rounded-lg border border-gray-200 shadow-sm p-6`
- **Form inputs:** `bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900`
- **Buttons:** Back (`bg-gray-100 text-gray-700`) / Continue (`bg-gray-900 text-white`), disabled state with `opacity-50`
- **Selection cards:** `border-2 rounded-lg p-4`, selected: `border-gray-900 bg-gray-50`, unselected: `border-gray-200 hover:border-gray-300`
- **Page wrapper:** `p-8` → `max-w-3xl mx-auto`

## Design notes for reasoning UI (Agent UI page)
- Skills list shows state + one-line summary in an execution timeline
- Reasoning details expand to show tool calls, LLM output, and latency
- Actions panel shows available operations with approval workflow
- Chat messages render AI recommendations with skill execution context
