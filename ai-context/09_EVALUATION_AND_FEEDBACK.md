# Evaluation + Feedback (Simplified MVP)

## What we measure (MVP)
- Run success rate (agent-marked or user-marked)
- Confidence distribution
- Doc hit rate: (docs_found > 0)
- Latency: end-to-end seconds
- Writeback success

## Feedback loop (MVP)
ServiceNow UI Action captures:
- success/fail
- reason
- notes
- run_id

Backend stores:
- feedback events per tenant and per classification path

## Self-correcting scaffolds (future-ready)
- If fail rate spikes for a classification path:
  - alert (later)
  - review doc coverage
  - adjust prompt route (manual for now)
- Maintain “Known Failure Modes” notes per tenant
  - included as small memory block in synthesis prompt
