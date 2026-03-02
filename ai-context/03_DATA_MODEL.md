# Canonical Data Model (MVP)

## WorkObject (generic input)
A generic “work task” abstraction: incident, case, problem, change, request, etc.

```ts
interface WorkObject {
  work_id: string
  source_system: "servicenow" | string
  record_type: string // e.g., "incident"
  title: string
  description: string
  classification: { name: string; value: string }[] // N levels, order matters
  metadata?: Record<string, any>
}
```

## Run + SkillExecution
```ts
interface AgentRun {
  run_id: string
  tenant_id: string
  status: "queued" | "running" | "completed" | "failed"
  started_at: string
  completed_at?: string
  work_object: WorkObject
  skills: SkillExecution[]
}
```

## Agent events (reasoning stream)
Events are the contract to power the “real-time reasoning UI”.

```ts
interface AgentEvent {
  run_id: string
  skill_id: string
  event_type: "thinking"|"retrieval"|"planning"|"tool_call"|"tool_result"|"memory_write"|"verification"|"complete"|"error"
  summary: string
  confidence?: number
  timestamp: string
  metadata?: Record<string, any>
}
```

## Tenant config objects
- ClassificationSchema: N level definitions (key, display_name, required)
- GoogleDriveConfig: root folder, shared drive id optional
- ServiceNowConfig: instance URL + auth (basic for MVP)
- PromptRoutes (thin): optional map keyed by `classification_path` → prompt template id

## Feedback model (MVP)
Feedback is a first-class event. It feeds evaluation and later “self-correction”.

```json
{
  "tenant_id": "acme",
  "run_id": "uuid",
  "work_id": "INC0012345",
  "outcome": "success" | "fail",
  "reason": "resolved" | "partial" | "wrong-doc" | "missing-context" | "other",
  "notes": "free text",
  "timestamp": "..."
}
```
