# Architecture (Simplified, Resellable)

## Overview
A multi-tenant control plane with two planes of concern:

- **Control Plane (Admin + Config):** Tenants, schema, connectors, storage settings, evaluation summaries.
- **Execution Plane (Runs):** Orchestrates skill chain, streams events, writes back to ServiceNow.

## Components
### Frontend (React)
- Tenant selector
- Setup wizard (tenant-scoped)
- Runs console (event stream visualization)

### Backend (FastAPI)
- Tenant store
- Config store (per tenant): schema, ServiceNow config, Drive config
- Run manager + event bus
- Orchestrator (executes skill chain)
- Providers:
  - `ServiceNowProvider` (connector)
  - `GoogleDriveProvider` (knowledge storage)

## Multi-tenant rules (non-negotiable)
- **Every request is tenant-scoped**
- No cross-tenant data leakage: return 404 on mismatch
- Tenant ID comes from:
  - UI: selected tenant
  - ServiceNow: tenant token → resolve tenant_id (MVP can pass tenant_id explicitly; production uses signed token)

## Execution pattern
- Create run → start orchestrator → publish event stream → subscribers receive replay + live events
- Event stream is the source of truth for UI “reasoning animation”

## Data storage (MVP)
Start with in-memory for speed; design interfaces so you can swap to Postgres later:
- Tenants table
- TenantConfig tables
- Runs + Events tables
- Feedback table

## API surface (MVP)
- `POST /tenants`, `GET /tenants`, `DELETE /tenants/{id}`
- `GET/PUT /admin/{tenant}/classification-schema`
- `GET/PUT /admin/{tenant}/google-drive`, `GET scaffold-plan`, `POST scaffold-apply`, `POST google-drive/test`
- `GET/PUT /admin/{tenant}/connectors/servicenow`, `POST servicenow/test`
- `POST /runs` (create run from canonical WorkObject)
- `POST /runs/from/servicenow` (MVP convenience)
- `WS /runs/{run_id}/events?tenant_id=...`

## Future
- Jira/Salesforce providers implement same connector interface
- Knowledge providers implement same storage interface (Dropbox, OneDrive)
