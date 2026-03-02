# Sprint Plan (Small + Disciplined)

## Sprint 1 — Prune + Minimal UI
- Keep: Tenants, Wizard, Runs Console
- Remove or hide: advanced dashboards, extra screens
- Ensure build passes

Deliverable:
- UI: /tenants, /setup, /runs
- Backend: tenants + configs + runs + websocket events

## Sprint 2 — Manual schema + Drive config + scaffold
- Wizard step: classification schema editor (N levels)
- Wizard step: drive config + test
- Apply scaffold (idempotent)

Deliverable:
- Drive folders created from schema

## Sprint 3 — ServiceNow connector (test + writeback)
- Store SN config per tenant
- Test endpoint
- Implement `POST /runs/from/servicenow` and writeback

Deliverable:
- Click UI action in ServiceNow → work_notes updated

## Sprint 4 — Retrieval + Claude synthesis
- Drive doc search (basic)
- Claude call with retrieved docs
- Stream reasoning events to UI

Deliverable:
- Real “skills + reasoning” run shows in console; work_notes includes sources

## Sprint 5 — Feedback + evaluation
- ServiceNow success/fail UI action
- Store feedback events; show basic metrics per tenant and per classification path

Deliverable:
- Self-correcting loop starts (visibility + data)
