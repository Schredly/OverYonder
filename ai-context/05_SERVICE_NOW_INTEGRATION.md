# ServiceNow Integration (MVP)

## Goal
From an Incident record, trigger the agent and write back the resolution to `work_notes`.

## Recommended pattern (MVP)
**ServiceNow calls your backend** via Scripted REST:
- UI Action button on Incident: "Suggest Resolution"
- UI Action builds payload from fields:
  - sys_id, number
  - short_description, description
  - category, subcategory (or custom N levels later)
  - assignment_group, priority (optional)
- Calls platform endpoint:
  - `POST https://<your-platform>/runs/from/servicenow`
- Platform runs orchestration and writes back using ServiceNow REST Table API:
  - `PATCH /api/now/table/incident/{sys_id}` with `work_notes`

## Auth (MVP)
- Use a per-tenant API key header from ServiceNow to platform:
  - `X-Tenant-Id: <tenant_id>` (or signed token later)
  - `X-Tenant-Key: <shared_secret>`
- Platform validates key matches tenant config.

## Writeback behavior
- Append to work notes:
  - Proposed resolution (bulleted)
  - “Sources” list (Drive file names/links)
  - Confidence score
  - Run id

## Feedback capture
Add a second UI Action:
- “Mark Agent Successful” / “Mark Agent Not Successful”
- Sends feedback to platform:
  - run_id (stored in work_notes or hidden field), outcome, reason, notes
- Platform stores feedback event and updates evaluation metrics.

## Future: SSO / no-login
MVP does not require SSO. Later:
- OAuth for ServiceNow
- Signed JWT “tenant token” minted by platform
