# Sprint Plan — OverYonder.ai Platform

## Completed sprints

### Sprints 1–33 — Foundation (completed)
- Multi-tenant control plane with tenant CRUD
- Tenant setup wizard (4-step stepper)
- Integration management (ServiceNow, Salesforce, Jira, Slack, Google Drive, Replit)
- Skills catalog and use case builder with multi-step orchestration
- Actions catalog with create/edit and visibility rules
- Agent UI with conversational interface, reasoning timeline, and actions panel
- Agent run persistence with execution history
- LLM usage tracking and cost ledger
- Observability: runs page, LLM usage page, cost ledger page
- Settings: LLM model configuration
- Tool execution: ServiceNow, Jira, Slack, Google Drive, Replit, PDF generation

### Genome Sprint 1 — Initial genome feature build (completed)
- Created shared mock dataset (`src/app/data/mockGenomes.ts`) with 6 genomes across 5 vendors
- Built genomes table page (`/genomes`) — 10 columns, clickable rows
- Built genome detail page (`/genomes/:id`) — 5 sections: header, overview, cost profile, structural genome, raw artifact
- Built genome capture wizard (`/genomes/capture`) — 5-step stepper
- Built genome insights dashboard (`/genomes/insights`) — metric cards, donut chart, bar charts, cost comparison table
- Added "App Genomes" section to sidebar navigation

### Genome Sprint 2 — UI consistency review + nav restructure (completed)
- Aligned GenomesPage table styling with TenantsPage patterns (border-border, text-muted-foreground, hover states)
- Fixed GenomeDetailPage wrapper and button colors
- Restructured sidebar: Use Cases before Actions, Runs moved into Observability section
- Fixed routes.tsx indentation

## Upcoming sprints

### Sprint — Backend genome API
- `POST /admin/{tenant}/genomes/capture` — initiate genome extraction from source platform
- `GET /admin/{tenant}/genomes` — list captured genomes
- `GET /admin/{tenant}/genomes/{id}` — get genome detail
- `DELETE /admin/{tenant}/genomes/{id}` — delete genome
- Connect capture wizard to real extraction logic (ServiceNow Table API discovery)
- Store genomes in backend store (in-memory, swappable)

### Sprint — Live genome extraction
- ServiceNow genome extractor: connect to instance, discover objects via Table API, extract workflows via Flow Designer API
- Map relationships from reference fields
- Calculate cost estimates from license and usage data
- Replace mock data with live extraction results

### Sprint — Migration planning
- Migration plan generator: analyze genome, recommend target platform, estimate costs
- "Rebuild Application" button triggers migration orchestration
- Track migration progress through runs
- Post-migration validation and cost comparison

### Sprint — Multi-vendor extraction
- Salesforce genome extractor (Metadata API)
- Jira genome extractor (REST API)
- Zendesk genome extractor
- Workday genome extractor
- Unified genome format across all vendors

### Sprint — Advanced insights
- Historical cost tracking (trends over time)
- Migration ROI calculator
- Cross-tenant benchmarking
- Exportable reports (PDF/CSV)
