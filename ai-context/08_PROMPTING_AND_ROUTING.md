# Prompting + Routing — OverYonder.ai Platform

## Prompt categories

### 1. Genome extraction prompts
Used when the agent analyzes a source platform to extract application structure.

**Inputs:**
- Platform type and version
- Discovered object list with metadata
- Workflow definitions and business rules
- Field schemas and data types

**Output format:**
- Structured GenomeDocument (objects, workflows, fields, relationships)
- Complexity assessment
- Migration risk factors

### 2. Migration analysis prompts
Used when analyzing a genome for migration feasibility and cost.

**Inputs:**
- Complete genome document
- Source platform cost data (license, operational)
- Target platform capabilities and pricing
- Industry benchmarks

**Output format:**
- Cost comparison table (legacy vs. migrated vs. operational)
- Savings percentage and absolute savings
- Risk assessment (low/medium/high)
- Recommended migration approach

### 3. Agent response prompts (Agent UI)
Used for conversational queries in the Agent UI.

**Inputs:**
- User query
- Retrieved context documents
- Connected platform data (ServiceNow records, Jira issues, etc.)
- Tenant-specific policy notes

**Output format:**
- Conversational response with recommendations
- Action suggestions (with approval workflow)
- Citations to source data
- Confidence level

## Prompt routing
Per-tenant configuration maps context → prompt template:
- `route_key` = derived from use case + skill + classification
- Maps to specific prompt template ID
- Default: baseline template per skill type

## Guardrails
- Never fabricate data — if evidence is missing, say so explicitly
- Always cite sources (document links, record references)
- Keep output format stable for downstream consumption
- Include run ID in all agent outputs for traceability
- Cost estimates must clearly state assumptions and data sources

## Output formatting (for writebacks)
When writing results back to source platforms:
- Summary (1 paragraph)
- Recommended steps (bulleted)
- Citations: document/record links
- Confidence (0–1)
- Run ID
