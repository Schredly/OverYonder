# Agent Orchestration (Skills + Reasoning) — Simplified MVP

## Skill chain (MVP)
1. **ValidateInputSkill**
   - validates tenant active
   - validates classification matches schema depth (N levels)
2. **RetrieveDocsSkill (Google Drive)**
   - searches Drive under tenant documents folder
   - returns top N doc links + snippets (if possible)
3. **SynthesizeResolutionSkill (Claude)**
   - uses ticket + retrieved docs as context
   - returns recommended resolution steps + confidence
4. **WritebackSkill (ServiceNow)**
   - PATCH incident work_notes with output
5. **RecordOutcomeSkill**
   - stores run + metrics placeholders (doc_count, latency, confidence)

## Reasoning UI contract
Every skill emits events:
- thinking, retrieval, planning, tool_call, tool_result, verification, complete, error
UI shows:
- state + one-line summary
- optional details: inputs, context_sources, plan_steps, tool_calls, outputs

## Tools (MVP)
- `drive_search(query, folder_id)` → doc list
- `drive_get(doc_id)` → metadata/content (if text)
- `servicenow_patch_incident(sys_id, work_notes)`
- `claude_chat(system_prompt, user_prompt, context_docs)`

## Concurrency
MVP can be sequential. Later parallelize retrieval + memory reads.

## Failure handling
- If no docs found: still synthesize with “insufficient context” and request missing info
- If writeback fails: emit error + store output so agent can paste manually
