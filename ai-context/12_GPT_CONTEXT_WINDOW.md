# GPT Context Window — OverYonder.ai: Agentic Enterprise Application Portability Platform

Use this document as the "seed context" for a new ChatGPT thread.

---

## 1) What we are building (one paragraph)
We are building **OverYonder.ai**, an agentic enterprise application portability platform that helps companies **extract, analyze, and migrate** applications across platforms to modernize operations and lower costs. The platform connects to source platforms (ServiceNow, Salesforce, Jira, Zendesk, Workday), captures a complete **application genome** (objects, workflows, fields, relationships), analyzes migration feasibility with cost comparisons, and facilitates rebuilding applications on target platforms. It features a multi-tenant control plane with integrations, skills, use cases, actions, an agent UI with conversational interface, and full observability (run history, LLM usage tracking, cost ledger).

---

## 2) Core concept: Application Genome
The **genome** is the central artifact. It is a complete structural capture of an enterprise application:

```typescript
interface GenomeDocument {
  objects: string[]        // tables, catalog items, entities
  workflows: string[]      // business processes, automations, flows
  fields: string[]         // data fields and attributes
  relationships: string[]  // "object_a → object_b" dependency links
}

interface Genome {
  id: string
  application_name: string
  vendor: string                  // ServiceNow, Salesforce, Jira, Zendesk, Workday
  source_platform: string         // e.g., "ServiceNow Orlando"
  target_platform: string         // e.g., "Salesforce Service Cloud"
  object_count: number
  workflow_count: number
  legacy_cost: number             // annual cost on current platform
  migrated_cost: number           // projected cost on target platform
  operational_cost: number        // ongoing ops cost
  captured_date: string
  category: string                // e.g., "IT Service Management"
  genome_document: GenomeDocument
}
```

---

## 3) Platform modules (current state)

| Module | Routes | Purpose |
|--------|--------|---------|
| Tenants | `/tenants`, `/tenants/create`, `/tenants/:id` | Multi-tenant management with 4-step setup wizard |
| Integrations | `/integrations`, `/integrations/:id` | Platform connections (ServiceNow, Salesforce, Jira, Slack, Google Drive, Replit) |
| Skills | `/skills`, `/skills/create`, `/skills/:id` | Agent skill definitions with instructions, model, and tools |
| Use Cases | `/use-cases`, `/use-cases/create`, `/use-cases/:id` | Multi-step orchestrated workflows (ordered skill chains) |
| Actions | `/actions`, `/actions/create`, `/actions/:id` | Agent action catalog with visibility rules |
| App Genomes | `/genomes`, `/genomes/capture`, `/genomes/insights`, `/genomes/:id` | Genome table, 5-step capture wizard, insights dashboard, detail view |
| Observability | `/runs`, `/observability`, `/observability/cost-ledger` | Run history, LLM usage tracking, cost ledger |
| Agent UI | `/agentui` | Conversational agent with reasoning timeline and actions |
| Settings | `/settings` | LLM model configuration |

---

## 4) Architecture

**Three planes:**
- **Control Plane:** Tenants, integrations, skills, use cases, actions, genome management, settings
- **Extraction Plane:** Connects to source platforms, extracts application genomes, analyzes costs
- **Execution Plane:** Orchestrates skill chains, streams reasoning events, executes tools, tracks LLM usage

**Tech stack:**
- Frontend: React + React Router v7 + Tailwind CSS + Lucide icons
- Backend: FastAPI (Python)
- LLM: Claude (via Anthropic API)
- Storage: In-memory stores (swappable to Postgres)

**Multi-tenant rules:** Every request is tenant-scoped. No cross-tenant data leakage.

---

## 5) Key workflows

### Genome capture flow
Source Platform → Application Type → Configure → Preview (objects/workflows/fields/relationships) → Confirm → Genome stored

### Agent run flow
User query → Use case selected → Skill chain executes → Tools called → Reasoning streamed → Result delivered → Run logged

### Migration flow (planned)
Load genome → Analyze complexity → Estimate costs → Generate migration plan → Rebuild on target → Validate

---

## 6) Integrations (current)
| Platform | Capabilities |
|----------|-------------|
| ServiceNow | Read/create/update/search records, genome extraction source |
| Salesforce | Connector ready, target platform for migrations |
| Jira | Search/create issues, genome extraction source |
| Slack | Send messages, agent notifications |
| Google Drive | Document storage and knowledge retrieval |
| Replit | Application rebuild target |

---

## 7) UI design patterns
- **Table pages:** `border-border`, `text-muted-foreground`, `bg-primary` buttons, `hover:bg-gray-50/50` rows
- **Dashboard pages:** `max-w-[1800px]`, `bg-gray-50`, metric cards with colored icon pills, pure CSS charts
- **Wizard pages:** `max-w-3xl`, numbered stepper, `bg-gray-900` primary buttons
- **Detail pages:** `max-w-7xl`, single wrapper div, section-based layout

---

## 8) Sidebar navigation order
```
Tenants
Integrations
Skills
Use Cases
Actions
App Genomes
  ├── Genomes
  ├── Capture
  └── Insights
Observability
  ├── Runs
  ├── LLM Usage
  └── Cost Ledger
Settings
```

---

## 9) What you (ChatGPT) should do in this thread
- Understand that this is an **application portability platform**, not just a ticketing agent
- The genome is the core artifact — extraction, analysis, and migration all revolve around it
- Provide implementation guidance aligned to the current architecture and UI patterns
- Enforce multi-tenant isolation in all suggestions
- Follow established UI patterns (table pages match TenantsPage, dashboards match CostLedgerPage, wizards match CreateTenantPage)
- Do NOT modify integrations, settings, LLM config, or tenant config pages unless explicitly asked
- Reference the Genome-tracking.md ledger for sprint history
