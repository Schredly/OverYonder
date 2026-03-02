# Google Drive Scaffolding (MVP)

## Goal
Create a deterministic folder scaffold per tenant based on manual classification schema.

## Drive layout
Under the configured root folder:

- `AgenticKnowledge/`
- `AgenticKnowledge/{tenant_id}/`
- `AgenticKnowledge/{tenant_id}/_schema/`
- `AgenticKnowledge/{tenant_id}/dimensions/`
- `AgenticKnowledge/{tenant_id}/dimensions/{LevelDisplayName}/`
- `AgenticKnowledge/{tenant_id}/documents/`
- `AgenticKnowledge/{tenant_id}/documents/by_classification/...` (optional, future)

MVP: create dimension folders; docs can live anywhere under `documents/`.

## Idempotency
`ensure_folder(name, parent_id)` must:
- search for existing by name+parent
- create if missing
- return folder id

## What gets uploaded
In `_schema/`:
- `classification_schema.json`
- `servicenow_config_redacted.json` (optional)
- `adapter_mapping.json` (optional)

## Search strategy (MVP)
Given classification path values:
- Query Drive within `{tenant}/documents/` for relevant docs using:
  - filename contains tokens
  - full-text (Drive API `q` limited; for MVP use filename+folder scoping)
- Return top N doc ids + names + links
Later add embeddings.
