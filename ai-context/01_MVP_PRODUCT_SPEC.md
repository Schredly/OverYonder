# MVP Product Spec — ServiceNow + Google Drive Self-Correcting Agent

## Goal
Prove the full “closed loop” in the smallest credible way:

1) Admin creates a tenant  
2) Admin configures classification schema (N levels)  
3) Admin configures Google Drive root and scaffolds folders from the schema  
4) Admin configures ServiceNow connector (dev instance)  
5) User opens a ServiceNow Incident and triggers “Run Agent”  
6) Platform retrieves relevant Drive docs under tenant + classification path  
7) Claude synthesizes best resolution  
8) Platform writes response into ServiceNow `work_notes`  
9) User marks success/failure in ServiceNow → platform stores outcome  
10) Platform shows basic quality metrics (per tenant, per classification path)

## Personas
- **Tenant Admin:** sets up tenant, schema, Drive, ServiceNow connector; monitors runs and feedback.
- **Service Desk Agent:** triggers agent from ServiceNow; reviews proposal; marks success/failure.

## Primary user journeys
### Journey A — Tenant onboarding wizard (admin)
- Create tenant
- Configure schema (N levels)
- Configure Drive (service account + root folder id + optional shared drive id)
- Scaffold Drive folders
- Configure ServiceNow (URL + credentials; test connectivity)
- Activate tenant (generates tenant API key / shared secret)

### Journey B — Run agent from ServiceNow (agent)
- On incident: click UI Action “Suggest Resolution”
- ServiceNow calls platform: passes ticket payload + classification levels + tenant id
- Platform runs skill chain; streams events to UI
- Platform updates incident work notes with suggested resolution + sources
- Service desk agent marks outcome (Success/Not Success) → platform records feedback event

## MVP Screens
- **Tenants:** list/create/delete; open Setup Wizard
- **Tenant Setup Wizard:** schema → Drive → scaffold → ServiceNow → activate
- **Runs Console:** list runs; run detail with skills timeline and “hidden-ish reasoning”
- **Knowledge (basic):** show scaffolded paths and last sync; later doc listing

## Extensibility hooks
- Connector interface: `ConnectorProvider` with `test()`, `fetch_ticket()`, `writeback()`, `receive_feedback()`
- Storage interface: `KnowledgeProvider` with `ensure_folder()`, `list_files()`, `get_file()`, `search_metadata()`
