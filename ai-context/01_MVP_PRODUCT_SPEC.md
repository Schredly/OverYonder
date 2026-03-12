# Product Spec — OverYonder.ai: Agentic Enterprise Application Portability

## Goal
Enable enterprise companies to extract, analyze, and migrate applications across platforms to modernize operations and reduce costs. The platform captures a complete "application genome" from a source platform, analyzes migration feasibility and savings, and facilitates rebuilding the application on a target platform.

**The full loop:**

1) Admin creates a tenant
2) Admin configures integrations (source and target platform connections)
3) Admin initiates genome capture from a source platform
4) Platform extracts the application genome (objects, workflows, fields, relationships)
5) Platform analyzes migration cost: legacy cost vs. migrated cost vs. operational cost
6) Platform provides insights dashboard showing savings potential across all captured genomes
7) Admin reviews genome detail and approves migration plan
8) Platform orchestrates application rebuild on target platform using the genome blueprint
9) Platform tracks migration quality and cost accuracy over time
10) Admin monitors all activity via observability tools (runs, LLM usage, cost ledger)

## Personas
- **Platform Admin:** Creates tenants, configures integrations, captures genomes, reviews migration analytics, manages skills/use cases/actions.
- **Migration Analyst:** Reviews genome detail pages, compares costs across platforms, identifies high-value migration candidates from the insights dashboard.
- **Agent User:** Interacts with the conversational Agent UI to query, analyze, and take actions on enterprise applications.

## Primary user journeys

### Journey A — Genome capture and analysis (admin)
- Create tenant and configure integrations (source + target platforms)
- Navigate to App Genomes > Capture
- Select source platform (ServiceNow, Salesforce, Jira, Zendesk, Workday)
- Select application type (Catalog Item, Workflow, Table Application, Custom App)
- Provide connection details and application metadata
- Preview extracted genome (objects, workflows, fields, relationships)
- Confirm capture → genome stored and visible in genomes table
- Review genome detail page for structural analysis
- Review insights dashboard for cross-genome cost analytics

### Journey B — Agent-assisted analysis (agent user)
- Open Agent UI with a conversational interface
- Ask questions about applications, costs, migration feasibility
- Agent runs use-case skill chains, calls tools (ServiceNow, Jira, Slack, etc.)
- Agent provides recommendations with reasoning timeline
- Actions panel shows available operations with approval workflows
- Runs captured in observability for auditability

### Journey C — Migration execution (admin)
- From genome detail page, click "Rebuild Application"
- Agent orchestrates migration using genome as blueprint
- Platform tracks rebuild progress through runs and events
- Post-migration: compare actual costs against projected savings

## Platform screens
- **Tenants:** list/create/delete; open tenant setup wizard
- **Tenant Setup Wizard:** 4-step wizard (Tenant Details → Integrations → Use Cases → Summary)
- **Integrations:** grid of platform connections (ServiceNow, Salesforce, Google Drive, Jira, Slack, Replit)
- **Integration Config:** per-integration connection settings and credentials
- **Skills:** skill catalog with definitions and configurations
- **Use Cases:** multi-step use case builder with skill chain orchestration
- **Actions:** action catalog with create/edit and visibility rules
- **App Genomes:**
  - Genomes table (all captured genomes with costs and metadata)
  - Genome detail (application overview, cost profile, structural genome, raw artifact)
  - Capture wizard (5-step: Source Platform → App Type → Configure → Preview → Confirm)
  - Insights dashboard (metric cards, vendor distribution, workflow complexity, migration savings)
- **Observability:**
  - Runs (execution history with detail timeline)
  - LLM Usage (token and cost tracking)
  - Cost Ledger (financial transaction ledger)
- **Agent UI:** conversational agent interface with reasoning timeline and actions panel
- **Settings:** LLM model configuration

## Extensibility hooks
- Connector interface: `ConnectorProvider` with `test()`, `fetch_ticket()`, `writeback()`, `receive_feedback()`
- Storage interface: `KnowledgeProvider` with `ensure_folder()`, `list_files()`, `get_file()`, `search_metadata()`
- Genome extraction interface: `GenomeExtractor` with `connect()`, `discover_objects()`, `extract_workflows()`, `map_relationships()`
