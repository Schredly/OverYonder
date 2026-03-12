# ServiceNow Integration — OverYonder.ai Platform

## Dual role
ServiceNow serves two purposes in the platform:

### 1. Source platform for genome extraction
- Connect to a ServiceNow instance to extract application genomes
- Discover objects (tables, catalog items, workflows, business rules)
- Map relationships between objects
- Capture field definitions and data types
- Calculate legacy cost metrics for migration analysis

### 2. Operational connector for agent runs
- Agent can read/write ServiceNow records during use case execution
- Tool calls: `servicenow_read_record`, `servicenow_create_record`, `servicenow_update_record`, `servicenow_search`
- Used by skills in the agent orchestration chain

## Integration configuration
Stored per tenant in the integrations store:
- Instance URL (e.g., `https://dev12345.service-now.com`)
- Authentication: username + password (basic auth for current phase)
- Connection status: tested/untested/failed
- Enabled: boolean toggle

## Genome extraction from ServiceNow
When capturing a genome from ServiceNow:
1. Connect to instance using stored credentials
2. Query Table API to discover application objects (`/api/now/table/sys_db_object`)
3. Query for workflows and business rules
4. Extract field definitions from dictionary entries
5. Map relationships via reference fields and foreign keys
6. Package into `GenomeDocument` format (objects, workflows, fields, relationships)
7. Calculate cost estimates based on license tier and user count

## Agent tool calls (during runs)
Available ServiceNow tools for agent orchestration:
- `servicenow_read_record(table, sys_id)` — read a single record
- `servicenow_create_record(table, fields)` — create a new record
- `servicenow_update_record(table, sys_id, fields)` — update existing record
- `servicenow_search(table, query)` — search records with encoded query

## Auth
- Per-tenant credentials stored in integration config
- Platform authenticates to ServiceNow using basic auth (current)
- Future: OAuth 2.0 / mutual auth for production

## Writeback behavior (for agent runs)
When an agent run produces output to write back to ServiceNow:
- PATCH the target record with results
- Include: resolution summary, sources, confidence score, run ID
- Append to work_notes for audit trail

## Future enhancements
- OAuth 2.0 authentication
- Real-time event subscription via ServiceNow Business Rules
- Automated genome re-capture on schema changes
- Bidirectional sync for migration validation
