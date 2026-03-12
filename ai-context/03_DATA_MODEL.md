# Data Model — OverYonder.ai Platform

## Genome (application portability core)
The genome is the central artifact — a complete structural capture of an enterprise application.

```ts
interface GenomeDocument {
  objects: string[]        // e.g., ["request", "approval", "task", "asset"]
  workflows: string[]      // e.g., ["manager approval", "procurement order"]
  fields: string[]         // e.g., ["request_id", "requested_by", "quantity"]
  relationships: string[]  // e.g., ["request → approval", "request → request_item"]
}

interface Genome {
  id: string
  application_name: string
  vendor: string                    // "ServiceNow" | "Salesforce" | "Jira" | "Zendesk" | "Workday"
  source_platform: string           // e.g., "ServiceNow Orlando"
  target_platform: string           // e.g., "Salesforce Service Cloud"
  object_count: number
  workflow_count: number
  legacy_cost: number               // annual cost on source platform
  migrated_cost: number             // projected annual cost on target platform
  operational_cost: number          // ongoing operational cost
  captured_date: string
  category: string                  // e.g., "IT Service Management", "HR Operations"
  genome_document: GenomeDocument
}
```

## WorkObject (generic input for agent runs)
A generic "work task" abstraction: incident, case, problem, change, request, etc.

```ts
interface WorkObject {
  work_id: string
  source_system: "servicenow" | "salesforce" | "jira" | string
  record_type: string              // e.g., "incident", "case", "issue"
  title: string
  description: string
  classification: { name: string; value: string }[]
  metadata?: Record<string, any>
}
```

## Run + SkillExecution
```ts
interface AgentRun {
  run_id: string
  tenant_id: string
  use_case_name: string
  status: "queued" | "running" | "completed" | "failed"
  started_at: string
  completed_at?: string
  total_latency_ms: number
  total_tokens: number
  steps: SkillExecution[]
  final_result?: string
}

interface SkillExecution {
  step_index: number
  skill_name: string
  status: "pending" | "running" | "completed" | "failed"
  model?: string
  tokens: number
  latency_ms: number
  tools: string[]
  result_summary?: string
  instructions?: string
  tool_calls?: ToolCall[]
  llm_output?: string
}
```

## Agent events (reasoning stream)
Events power the real-time reasoning UI timeline.

```ts
interface AgentEvent {
  run_id: string
  skill_id: string
  event_type: "thinking" | "retrieval" | "planning" | "tool_call" | "tool_result" | "memory_write" | "verification" | "complete" | "error"
  summary: string
  confidence?: number
  timestamp: string
  metadata?: Record<string, any>
}
```

## LLM Usage (cost tracking)
```ts
interface LLMUsageRow {
  id: string
  timestamp: string
  tenant: string
  useCase: string
  skill: string
  model: string
  tokens: number
  cost: number
  latency: string
  runId: string
}
```

## Tenant config objects
- **Integration:** id, integration_type, enabled, connection_status, config fields per type
- **Skill:** id, name, description, instructions, model, tools
- **UseCase:** id, name, description, status, steps (ordered skill chain)
- **Action:** id, name, description, type, handler, visibility rules
- **LLMConfig:** model selection and parameter settings

## Feedback model
Feedback captures migration quality and agent run outcomes.

```json
{
  "tenant_id": "acme",
  "run_id": "uuid",
  "work_id": "INC0012345",
  "outcome": "success | fail",
  "reason": "resolved | partial | wrong-doc | missing-context | other",
  "notes": "free text",
  "timestamp": "..."
}
```
