# Claude Ground Rules (DO NOT DRIFT)

You are implementing the Simplified MVP for the Self-Correcting Agentic System.

## Non-negotiables
- Multi-tenant isolation: every endpoint is tenant-scoped; no leakage
- Keep UI minimal: Tenants → Wizard → Runs Console
- ServiceNow only for MVP; preserve extension points for future connectors
- Manual classification schema (N levels) in wizard
- Google Drive only for MVP; preserve extension points for other storage providers
- Reasoning UI uses the event stream; do not dump chain-of-thought, only structured summaries

## MVP definition of “done”
- Tenant can be created
- Tenant wizard config saved:
  - ServiceNow connector (test passes)
  - Classification schema saved
  - Drive configured and scaffold applied
- ServiceNow UI action triggers run and writes to work notes
- Feedback action records success/failure and shows it in platform metrics

## What NOT to add
- Jira/Salesforce implementations
- Vector databases / embeddings
- Big dashboards
- Complex agent routing learning loops
- Complex auth/SSO (use shared secret for MVP)

## Output formatting
- Work notes output must be stable and readable
- Include citations (doc links)
- Include run id
