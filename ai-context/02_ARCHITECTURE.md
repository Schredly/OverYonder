# Architecture — OverYonder.ai Platform

## Overview
A multi-tenant control plane with three planes of concern:

- **Control Plane (Admin + Config):** Tenants, integrations, skills, use cases, actions, genome management, settings.
- **Extraction Plane (Genomes):** Connects to source platforms, extracts application structure, analyzes costs.
- **Execution Plane (Runs):** Orchestrates skill chains, streams reasoning events, executes tools, tracks LLM usage.

## Components

### Frontend (React + React Router v7)
- Sidebar navigation with expandable sections
- Tenant setup wizard (4-step stepper)
- Genome capture wizard (5-step stepper)
- Genomes table, detail, and insights dashboard
- Agent UI (conversational interface with reasoning timeline)
- Observability tools (runs, LLM usage, cost ledger)
- Integration management grid
- Skills, use cases, and actions editors

### Backend (FastAPI)
- Tenant store (multi-tenant CRUD)
- Integration store (per-tenant platform connections)
- Genome store (captured application genomes)
- Skill + Use Case + Action stores
- Run manager + event bus (execution tracking)
- Orchestrator (executes skill chains with tool calls)
- LLM usage ledger (token/cost tracking per execution)
- Providers:
  - `ServiceNowProvider` (connector + genome extraction)
  - `SalesforceProvider` (connector)
  - `JiraProvider` (connector)
  - `SlackProvider` (notifications)
  - `GoogleDriveProvider` (knowledge storage)
  - `ReplitProvider` (application rebuilding)
  - `PDFProvider` (document generation)

## Multi-tenant rules (non-negotiable)
- **Every request is tenant-scoped**
- No cross-tenant data leakage: return 404 on mismatch
- Tenant ID comes from:
  - UI: selected tenant in tenant selector dropdown
  - API: tenant token or explicit tenant_id header

## Execution pattern
- Create run → start orchestrator → publish event stream → subscribers receive replay + live events
- Event stream is the source of truth for the reasoning UI timeline
- Every LLM call records tokens, cost, model, latency in the usage ledger

## Data storage
- In-memory stores (current) with swappable interface design for future Postgres migration
- Tables: Tenants, Integrations, Skills, UseCases, Actions, Genomes, Runs, Events, Feedback, LLMUsage

## API surface
- `POST/GET/DELETE /tenants/{id}`
- `GET/POST/DELETE /admin/{tenant}/integrations`
- `GET/PUT /admin/{tenant}/integrations/{id}`
- `GET/POST/DELETE /admin/{tenant}/skills`
- `GET/POST/DELETE /admin/{tenant}/use-cases`
- `GET/POST/DELETE /admin/{tenant}/actions`
- `GET/POST /admin/{tenant}/genomes` (genome CRUD + capture)
- `POST /agent/run` (create agent run from use case)
- `GET /admin/{tenant}/llm-usage` (usage ledger + summary)
- `GET /admin/{tenant}/runs` (execution history)

## Current integrations
| Integration | Purpose | Status |
|-------------|---------|--------|
| ServiceNow | Source platform for genome extraction + ticket operations | Implemented |
| Salesforce | Target/source platform for migrations | Connector ready |
| Jira | Source platform for project genome extraction | Connector ready |
| Zendesk | Source platform for support app extraction | Planned |
| Workday | Source platform for HR app extraction | Planned |
| Google Drive | Knowledge document storage | Implemented |
| Slack | Agent notifications and alerts | Implemented |
| Replit | Application rebuild target | Implemented |
