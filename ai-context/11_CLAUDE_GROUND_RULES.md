# Claude Ground Rules (DO NOT DRIFT)

You are implementing the OverYonder.ai Agentic Enterprise Application Portability Platform.

## Platform identity
OverYonder.ai helps enterprise companies **extract, analyze, and migrate** applications across platforms to modernize operations and lower costs. The core artifact is the **application genome** — a complete structural capture of an enterprise application's objects, workflows, fields, and relationships.

## Non-negotiables
- **Multi-tenant isolation:** every endpoint is tenant-scoped; no cross-tenant data leakage
- **Genome-centric architecture:** the genome is the core data model for portability — extraction, analysis, and migration all operate on genomes
- **Multi-vendor support:** architecture must support ServiceNow, Salesforce, Jira, Zendesk, Workday as source/target platforms
- **Cost transparency:** every LLM call tracks tokens, cost, model, and latency in the usage ledger
- **Reasoning UI uses the event stream:** structured skill execution timeline, not raw chain-of-thought dumps
- **Do not modify existing pages** (integrations, settings, LLM config, tenant config) unless explicitly asked

## Current platform modules
| Module | Route(s) | Status |
|--------|----------|--------|
| Tenants | `/tenants`, `/tenants/create`, `/tenants/:id` | Complete |
| Integrations | `/integrations`, `/integrations/:id` | Complete |
| Skills | `/skills`, `/skills/create`, `/skills/:id` | Complete |
| Use Cases | `/use-cases`, `/use-cases/create`, `/use-cases/:id` | Complete |
| Actions | `/actions`, `/actions/create`, `/actions/:id`, `/actions/:id/visibility` | Complete |
| App Genomes | `/genomes`, `/genomes/capture`, `/genomes/insights`, `/genomes/:id` | UI complete, backend pending |
| Observability | `/runs`, `/runs/:id`, `/observability`, `/observability/cost-ledger` | Complete |
| Agent UI | `/agentui` | Complete |
| Settings | `/settings` | Complete |

## UI patterns to follow
- **Table pages:** Match TenantsPage — `border-border`, `text-muted-foreground`, `hover:bg-gray-50/50`, `bg-primary` buttons
- **Dashboard pages:** Match CostLedgerPage — `max-w-[1800px]`, `bg-gray-50 min-h-screen`, metric cards with icon pills
- **Wizard pages:** Match CreateTenantPage — `max-w-3xl`, stepper with numbered circles, `bg-gray-900` primary buttons
- **Detail pages:** `max-w-7xl`, single wrapper div, `bg-gray-900` for primary CTA

## What NOT to add without explicit request
- Complex auth/SSO (use simple credentials for current phase)
- Vector databases / embeddings
- Real-time collaboration features
- Mobile-specific layouts

## Output formatting
- Agent outputs must be stable and readable
- Include citations (document/record links) where applicable
- Include run ID for traceability
- Cost estimates must state assumptions clearly
