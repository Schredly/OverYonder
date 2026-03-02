# New GPT Context Window — Self-Correcting Agentic System (Simplified MVP)

Use this document as the “seed context” for a new ChatGPT thread.

---

## 1) What we are building (one paragraph)
We are building a **multi-tenant** self-correcting agentic system that integrates with **ServiceNow** and **Google Drive**. A tenant admin uses a **wizard** to configure a customer tenant (ServiceNow connector, manual N-level classification schema, Google Drive root). The system scaffolds Drive folder structure from the classification schema. In ServiceNow, an agent clicks a UI Action on an Incident that sends ticket fields + classification values to our platform. Our platform runs a skill-based agent chain with real-time reasoning events, retrieves relevant documents from Drive, synthesizes a recommended resolution using Claude, writes it back into the incident’s work notes, and collects success/failure feedback to measure and improve outcomes over time.

---

## 2) MVP scope (start small)
### In scope
- Multi-tenant: create/delete tenants
- Wizard onboarding per tenant:
  1) Configure ServiceNow connector (basic auth + test)
  2) Configure classification schema (manual, N levels)
  3) Configure Google Drive (service account + root folder + test)
  4) Scaffold Drive folder structure from schema (idempotent)
  5) Activate tenant (creates tenant shared secret)
- Execution:
  - `POST /runs/from/servicenow` accepts ticket payload and starts a run
  - Skill chain: validate → retrieve docs → synthesize → writeback → record metrics
  - WebSocket event stream drives the reasoning UI
- Feedback:
  - ServiceNow UI Action posts success/failure feedback back to platform
  - Minimal metrics: success rate, confidence, doc hit rate, latency

### Out of scope (for now)
- Jira/Salesforce connectors (keep extension points only)
- Auto-discover classification from ServiceNow
- Embeddings/vector DB
- Full prompt routing optimization loop
- “Golden data pipeline” normalization
- SSO (use shared secret per tenant for MVP)

---

## 3) Key concepts to keep
### Adaptive Context Architecture
Classification determines which Drive folders/docs to search. Context is fetched on demand and filtered—never dump everything in prompts.

### Instance-specific optimization (thin)
We keep a place to store different prompt templates per classification path, but initially use one baseline prompt.

### Durable memory (thin)
Store “known failure modes” notes per tenant and include a small memory block in synthesis.

### Continuous evaluation (thin)
Store feedback per tenant and per classification path; show trends later.

---

## 4) Minimal data model
- Tenant: id, name, status (draft/active), enabled_adapters (ServiceNow for MVP), created_at
- ClassificationSchema: tenant_id, levels[] (key, display_name, required), version, updated_at
- GoogleDriveConfig: tenant_id, root_folder_id, shared_drive_id?, status, updated_at
- ServiceNowConfig: tenant_id, instance_url, username, password, table_api_base, updated_at
- AgentRun + AgentEvent (reasoning stream)
- FeedbackEvent (success/fail + reason + notes)

---

## 5) Interfaces for future extensibility
- `ConnectorProvider` interface: test(), fetch_ticket(), writeback(), receive_feedback()
- `KnowledgeProvider` interface: ensure_folder(), list_files(), get_file(), search()

MVP implements:
- ServiceNowProvider
- GoogleDriveProvider

---

## 6) UI (minimal)
- Tenants (create/delete)
- Tenant Setup Wizard (ServiceNow → schema → Drive → scaffold → activate)
- Runs Console (skills timeline + hidden-ish reasoning drawer)

---

## 7) ServiceNow integration (MVP)
- UI Action: “Suggest Resolution” calls platform endpoint with incident data + classification values
- Platform writes to `work_notes`
- UI Action: “Mark Success/Fail” posts feedback back to platform

---

## 8) What you (ChatGPT) should do in this thread
- Provide a simplified sprint plan aligned to the MVP
- Provide Claude prompts that implement one sprint at a time
- Provide Figma prompts for the minimal wizard and run console
- Enforce “do not drift” constraints and multi-tenant isolation
