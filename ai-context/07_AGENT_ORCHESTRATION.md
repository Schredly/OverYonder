# Agent Orchestration — OverYonder.ai Platform

## Overview
The platform uses a skill-based orchestration model. Use cases define ordered chains of skills. Each skill has instructions, a model, and available tools. The orchestrator executes skills sequentially, streaming reasoning events to the UI.

## Skill chain patterns

### Pattern A — Genome extraction chain
1. **ValidateConnectionSkill** — verify source platform credentials and connectivity
2. **DiscoverObjectsSkill** — query source platform APIs to enumerate objects, tables, catalog items
3. **ExtractWorkflowsSkill** — extract workflow definitions, business rules, automations
4. **MapRelationshipsSkill** — analyze reference fields and foreign keys to build relationship graph
5. **PackageGenomeSkill** — assemble the GenomeDocument and calculate cost metrics
6. **RecordOutcomeSkill** — store genome and emit completion event

### Pattern B — Migration analysis chain
1. **LoadGenomeSkill** — retrieve the captured genome document
2. **AnalyzeComplexitySkill** — assess workflow complexity, dependency depth, customization density
3. **EstimateCostsSkill** — calculate legacy, migrated, and operational cost projections
4. **GenerateReportSkill** — produce migration feasibility report with recommendations
5. **RecordOutcomeSkill** — store analysis results

### Pattern C — Agent-assisted query (via Agent UI)
1. **ValidateInputSkill** — validate tenant active, parse user query intent
2. **RetrieveContextSkill** — search knowledge docs, fetch relevant records from connected platforms
3. **SynthesizeResponseSkill (Claude)** — use query + retrieved context to generate response with recommendations
4. **ExecuteActionsSkill** — if user approves recommended actions, execute tool calls
5. **RecordOutcomeSkill** — store run + metrics (token count, latency, cost)

## Reasoning UI contract
Every skill emits events:
- `thinking`, `retrieval`, `planning`, `tool_call`, `tool_result`, `verification`, `complete`, `error`

UI shows:
- Execution timeline with step-by-step progress
- State badge + one-line summary per skill
- Expandable details: tool calls with request/response, LLM output, latency, tokens
- Final result panel

## Tools (current)
| Tool | Purpose |
|------|---------|
| `servicenow_read_record(table, sys_id)` | Read a ServiceNow record |
| `servicenow_create_record(table, fields)` | Create a ServiceNow record |
| `servicenow_update_record(table, sys_id, fields)` | Update a ServiceNow record |
| `servicenow_search(table, query)` | Search ServiceNow records |
| `jira_search(jql)` | Search Jira issues |
| `jira_create_issue(project, fields)` | Create a Jira issue |
| `slack_send_message(channel, text)` | Send a Slack message |
| `drive_search(query, folder_id)` | Search Google Drive documents |
| `drive_get(doc_id)` | Get Drive document content |
| `generate_pdf(content, filename)` | Generate a PDF report |
| `replit_create_app(spec)` | Create an application on Replit |
| `claude_chat(system, user, context)` | LLM inference call |

## Concurrency
Current: sequential skill execution within a use case.
Future: parallelize independent retrieval + analysis steps.

## Failure handling
- If a tool call fails: emit error event, skill marks as failed, run continues or halts based on criticality
- If LLM call fails: retry once, then mark skill as failed with error details
- All failures are visible in the runs detail page with full error context

## LLM cost tracking
Every LLM call during orchestration records:
- Model used, token count (input + output), cost, latency
- Linked to run_id, tenant, use case, and skill
- Aggregated in the Cost Ledger page
