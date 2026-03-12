# Evaluation + Feedback — OverYonder.ai Platform

## What we measure

### Agent run metrics
- Run success rate (completed vs. failed)
- Average latency (end-to-end seconds)
- Token usage per run and per skill
- LLM cost per run (tracked in cost ledger)
- Tool call success rate

### Genome extraction metrics
- Extraction completeness (objects discovered vs. expected)
- Relationship mapping accuracy
- Workflow capture coverage
- Time to extract per application

### Migration analysis metrics
- Cost estimate accuracy (projected vs. actual post-migration)
- Savings realization rate
- Migration success rate (applications fully rebuilt)
- Time to migrate per application

### Platform health metrics
- Active tenants and usage patterns
- Integration connection health
- LLM cost trends over time (via cost ledger)
- Most expensive use cases and skills

## Feedback loop

### Agent run feedback
Captured via the Agent UI or platform integrations:
- Success/failure outcome
- Reason category (resolved, partial, wrong-doc, missing-context, other)
- Free-text notes
- Linked to run_id for traceability

### Migration feedback
Post-migration validation:
- Actual cost vs. projected cost
- Feature parity assessment
- User satisfaction score
- Issues encountered during migration

## Observability tools (current UI)

### Runs page (`/runs` — inside Observability)
- Filterable list of all agent runs
- Search by run ID, tenant, or use case
- Status filter pills (All, Completed, Running, Failed)
- Date range filter
- Click-through to run detail with full execution timeline

### LLM Usage page (`/observability`)
- Per-execution token and cost breakdown
- Group by: model, use case, tenant, skill
- Time range filtering

### Cost Ledger page (`/observability/cost-ledger`)
- Financial transaction ledger with summary metric cards
- Total cost, total tokens, avg cost per run, most expensive use case
- Execution detail drawer with pricing breakdown

## Self-correcting scaffolds (future)
- If failure rate spikes for a use case: alert and suggest prompt adjustments
- Track "known failure modes" per tenant as context for future runs
- Automated re-extraction of genomes when source platform schemas change
- Cost estimate calibration based on actual post-migration data
