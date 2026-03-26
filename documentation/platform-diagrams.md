# OverYonder Platform Architecture & Process Flows

---

## 1. High-Level Platform Architecture

```
+===========================================================================+
|                          OverYonder Platform                              |
+===========================================================================+
|                                                                           |
|   +------------------+    +------------------+    +------------------+    |
|   |    Admin Panel    |    |  Genome Studio   |    |    Agent UI      |    |
|   |   /settings       |    |  /genome-studio  |    |   /agent         |    |
|   |   /tenants        |    |                  |    |   /runs          |    |
|   |   /use-cases      |    |  Explorer | Chat |    |   /runs/:id      |    |
|   |   /skills         |    |  Workspace|Trans.|    |                  |    |
|   +--------+---------+    +--------+---------+    +--------+---------+    |
|            |                       |                       |              |
+============|=======================|=======================|==============+
             |                       |                       |
     +-------v-----------------------v-----------------------v-------+
     |                     FastAPI Backend (:8000)                    |
     |                                                               |
     |  +------------+  +-------------+  +-----------+  +----------+ |
     |  |  Admin API  |  | Studio API  |  |  Runs API |  | Agent API| |
     |  | /admin/{t}/ |  | /genome/    |  |  /runs/   |  | /agent/  | |
     |  +------+-----+  +------+------+  +-----+-----+  +----+----+ |
     |         |                |               |              |      |
     |  +------v----------------v---------------v--------------v---+  |
     |  |                   Service Layer                          |  |
     |  |  genome_builder | orchestrator | claude_client | ...     |  |
     |  +--+-------------+-------------+-------------+-----------+  |
     |     |             |             |             |               |
     |  +--v---+   +----v----+   +----v----+   +----v----------+    |
     |  |Genome|   | GitHub  |   | Claude  |   | Google Drive  |    |
     |  |Worker|   |Provider |   |  / GPT  |   |   Provider    |    |
     |  +--+---+   +----+----+   +----+----+   +----+----------+    |
     |     |             |             |             |               |
     +-----|-------------|-------------|-------------|---------------+
           |             |             |             |
     +-----v---+  +-----v----+  +-----v-----+  +---v-----------+
     |In-Memory|  |  GitHub   |  | Anthropic |  | Google Drive  |
     |  Stores |  |   Repo    |  |  / OpenAI |  |   Folders     |
     +---------+  +----------+  +-----------+  +---------------+

  External Systems:
     +---------------+     +---------------+
     |  ServiceNow   |     |    Replit      |
     |  (source &    |     |  (deployment   |
     |   writeback)  |     |   target)      |
     +---------------+     +---------------+
```

---

## 2. Extraction-to-Genome-to-GitHub Flow

```
 EXTRACTION                    GENOME PROCESSING                GITHUB SYNC
 ==========                    =================                ===========

 +-----------------+
 | ServiceNow API  |
 | Salesforce API  |
 | Jira / Zendesk  |
 | Workday / Other |
 +--------+--------+
          |
          | Raw API response
          v
 +--------+--------+
 | Vendor Adapter   |  normalize_servicenow_catalog()
 | (Normalizer)     |  normalize_salesforce_objects()
 +--------+--------+  etc.
          |
          | Normalized payload
          | {tables, fields, workflows, relationships}
          v
 +--------+--------+
 | POST /extractions|  Creates ExtractionPayload
 | status: pending  |  payload_hash: SHA-256
 +--------+--------+
          |
          |  Genome Worker polls every 30s
          |  (or wakes immediately)
          v
 +--------+---------+     duplicate?     +------------------+
 | Genome Worker     +----YES----------->| Link to existing |
 | (background task) |                   | genome, skip     |
 +--------+----------+                   +------------------+
          | NO
          v
 +--------+----------+
 | genome_builder.py  |  Pure deterministic (no LLM)
 |                    |  Dispatches by vendor:
 | - parse tables     |    ServiceNow -> tables, business_rules
 | - parse fields     |    Salesforce -> sobjects, flows
 | - parse workflows  |    Jira -> projects, automations
 | - parse relations  |    Zendesk -> triggers, ticket_forms
 +--------+----------+    Workday -> business_objects
          |
          | GenomeDocument (flat)
          v
 +--------+----------+
 | genome_graph_      |  Converts flat -> structured
 | builder.py         |
 |                    |  Objects: normalized ID slugs
 | - bind fields to   |  Fields: prefix-matched to objects
 |   objects           |  Unmatched -> "global" virtual object
 | - infer cardinality |  Relationships: "A -> B" with cardinality
 | - attach workflows  |  Workflows: matched to objects by name
 +--------+----------+
          |
          | GenomeDocument + GenomeGraph
          v
 +--------+-----------+
 | ApplicationGenome   |  Stored in genome_store
 | GenomeArtifact v1   |  Artifact = versioned snapshot
 | status: completed   |
 +--------+-----------+
          |
          |  Visible in /genomes list & detail pages
          |  User opens in Genome Studio
          v
 +--------+-----------+
 | Genome Studio       |
 | "Transform" button  |
 +--------+-----------+
          |
          | User prompt: "Convert to Replit app"
          v
 +--------+-----------+
 | LLM (Claude/GPT)    |  Generates structured filesystem_plan:
 |                      |  {
 | POST /genome/        |    branch_name: "genome-mod-<ts>",
 |       transform      |    base_path: "genomes/tenants/acme/...",
 +--------+------------+    folders: ["transformations/"],
          |                  files: [{path, content}, ...]
          |                }
          v
 +--------+------------+
 | POST /genome/save    |  User clicks "Save"
 +--------+------------+
          |
          v
 +--------+------------+
 | GitHub Provider       |
 |                       |
 | 1. create_branch()    |  New branch from main
 | 2. create_or_update_  |  Write each file
 |    file() x N         |  Under transformations/ folder
 +--------+-------------+
          |
          v
 +--------+-------------+
 |  GitHub Repository     |
 |                        |
 |  main                  |
 |    genomes/            |
 |      tenants/acme/     |
 |        vendors/SN/     |
 |          app_name/     |
 |            genome.yaml |
 |                        |
 |  genome-mod-<ts>  <--- NEW BRANCH
 |    genomes/.../        |
 |      transformations/  |
 |        app.py          |
 |        schema.sql      |
 |        README.md       |
 +------------------------+
```

---

## 3. Translation Flow: Genome to New GitHub Branch

```
 CREATE RECIPE                     RUN TRANSLATION
 =============                     ===============

 After a successful transform:     Given a saved translation recipe:

 +---------------------+           +---------------------+
 | Genome Studio has:   |           | Select a DIFFERENT  |
 | - Original genome    |           | genome to translate |
 | - Output files       |           +----------+----------+
 | - Chat context       |                      |
 +----------+----------+                       v
            |                       +----------+----------+
            v                       | POST /genome/        |
 +----------+----------+            |   run-translation    |
 | POST /genome/        |           |                      |
 | generate-translation-|           | Inputs:              |
 | recipe               |           | - translation_id     |
 |                      |           | - new genome content |
 | LLM reverse-engineers|           | - branch/folder scope|
 | reusable instructions|           +----------+----------+
 +----------+----------+                       |
            |                                  v
            | Returns:              +----------+----------+
            | {                     | LLM applies saved    |
            |   instructions,       | recipe.instructions  |
            |   output_structure,   | to new genome content|
            |   description         |                      |
            | }                     | Same structured      |
            v                       | filesystem_plan      |
 +----------+----------+            | output format        |
 | POST /genome/        |           +----------+----------+
 |   save-translation   |                      |
 |                      |                      v
 | Persists as reusable |           +----------+----------+
 | Translation record:  |           | POST /genome/save    |
 |                      |           | Commit to NEW branch |
 | - id: trans_xxx      |           +----------+----------+
 | - name               |                      |
 | - source_vendor      |                      v
 | - target_platform    |           +----------+----------+
 | - instructions (LLM) |          | GitHub: new branch    |
 | - output_structure   |           |   genome-trans-<ts>  |
 | - status: active     |           |     transformations/ |
 +----------------------+           |       generated files|
                                    +---------------------+

 EXAMPLE END-TO-END:
 ===================

 1. Transform ServiceNow ITSM genome -> Replit web app
 2. Save recipe: "Convert SN catalog app to Python Flask"
 3. Next week: load a DIFFERENT ServiceNow genome (HR Portal)
 4. Run saved translation -> LLM applies same recipe to HR Portal
 5. New branch created with HR Portal -> Flask app files
 6. Repeat for any ServiceNow genome with one click
```

---

## 4. Admin Capabilities

### Tenant Management
- **Create/activate tenants** with unique shared secrets for API auth
- **Multi-tenant isolation** -- all data scoped by tenant_id
- Tenant statuses: `draft` -> `active` (activation generates auth secret)

### Integration Configuration
- **ServiceNow**: instance URL + credentials for data extraction and writeback
- **Google Drive**: OAuth folder config, schema-based folder scaffolding
- **Replit**: session-based connection for deployment targets
- **Custom integrations**: arbitrary config with enable/disable toggle
- **Connection diagnostics**: test connectivity, view recent failures

### LLM Configuration
- **Multi-provider**: Anthropic (Claude) and OpenAI models
- **Per-tenant assignment**: assign LLM config to specific tenants
- **API key validation**: test keys before saving
- **Cost tracking**: input/output token pricing per model
- Available models: Claude Sonnet/Haiku, GPT-5, GPT-4o, o3/o4-mini

### Classification Schema
- Hierarchical node tree for organizing documents in Drive
- Auto-scaffolds Google Drive folder structure to match schema
- Used by Agent UI for document retrieval routing

### Observability & Metrics
- **Aggregate metrics**: total runs, success rate, avg confidence, doc hit rate, writeback success
- **Trend analysis**: 7-day and 30-day time series (runs, success rate, confidence, latency)
- **Breakdown by classification path**: top 10 paths with per-path success rates
- **Integration diagnostics**: real-time status of Drive, Claude, and ServiceNow connections

### Use Case & Skill Management
- **Skills catalog**: ValidateInput, RetrieveDocs, SynthesizeDocs, GenerateAnswer, Writeback
- **Use cases**: named configurations of ordered skill chains with trigger keywords
- **Step sequencing**: define input mappings between skill outputs and next skill inputs

---

## 5. Genome Studio Capabilities

```
+===========================================================================+
|                         Genome Studio Layout                              |
+===========================================================================+
|                            |                                              |
|   GENOME EXPLORER          |         CHAT INTERFACE                       |
|   (left sidebar)           |         (top right)                          |
|                            |                                              |
|   genomes/                 |   "What objects does this genome have?"      |
|     tenants/               |   "How are incidents related to requests?"   |
|       acme/                |   "What workflows trigger on assignment?"    |
|         vendors/           |                                              |
|           ServiceNow/      |   LLM-powered Q&A with full genome context  |
|             ITSM/          |   Returns reasoning steps + analysis         |
|               genome.yaml  |                                              |
|               fields.yaml  |----------------------------------------------|
|             HR/            |                                              |
|               genome.yaml  |         INTEGRATION ACTIONS                  |
|           Salesforce/      |         (right sidebar)                      |
|             CRM/           |                                              |
|               genome.yaml  |   [ Available Translations ]                 |
|                            |   - SN -> Flask App                          |
|----------------------------|   - SN -> React Dashboard                    |
|                            |   - SF -> API Spec                           |
|   GENOME WORKSPACE         |                                              |
|   (bottom left)            |   [ Run Translation ]                        |
|                            |   [ Save as Translation ]                    |
|   Loaded genome content    |   [ Transform (freeform) ]                   |
|   (YAML/JSON viewer)       |                                              |
|   Collapsible sections     |   [ Trigger: Replit / ServiceNow ]           |
|   File tree navigation     |                                              |
+===========================================================================+
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Browse** | Navigate GitHub repo tree -- genomes organized by tenant/vendor/app |
| **Load** | View raw YAML/JSON genome files in workspace panel |
| **Chat** | Conversational Q&A about any loaded genome (LLM-powered) |
| **Transform** | Freeform LLM prompt -> structured filesystem_plan (files + folders) |
| **Save** | Commit transformation output to new GitHub branch (never overwrites main) |
| **Create Recipe** | Reverse-engineer a reusable translation from a completed transformation |
| **Run Translation** | Apply a saved recipe to a different genome with one click |
| **Trigger Actions** | Push to Replit for deployment or back to ServiceNow |
| **Video Extract** | Upload video -> LLM vision analysis -> genome.yaml output |
| **Doc Extract** | Upload document -> parse into genome structure |

---

## 6. Agent UI Capabilities

```
 USER SUBMITS WORK ITEM                    SKILL CHAIN EXECUTION
 ======================                    =====================

 +-------------------+
 | Agent UI (/agent)  |
 |                    |        +------------------------------------------+
 | Title: "Laptop     |        |  Orchestrator (background task)           |
 |  won't connect     |        |                                          |
 |  to VPN"           |        |  1. ValidateInput                        |
 |                    |        |     - Check tenant active                 |
 | Classification:    |   +--->|     - Verify Drive configured             |
 |  IT > Network >    |   |    |     -> event: validation_passed          |
 |  VPN               |   |    |                                          |
 |                    |   |    |  2. RetrieveDocs                          |
 | [Submit] ----------+---+    |     - Navigate Drive by classification    |
 +-------------------+         |     - Fetch matching KB articles          |
                               |     -> event: docs_found (3 matches)     |
 POST /api/runs                |                                          |
 -> run_id returned            |  3. SynthesizeDocs                       |
 -> WebSocket /ws/{run_id}     |     - LLM extracts key resolution steps  |
    for live events            |     -> event: synthesis_complete          |
                               |                                          |
                               |  4. GenerateAnswer                       |
                               |     - Claude generates resolution         |
                               |     - Dual answers: KB-based + LLM-based |
                               |     -> event: answers_ready              |
                               |                                          |
                               |  5. Writeback (optional)                  |
                               |     - Post resolution to ServiceNow      |
                               |     - Update work notes + status          |
                               |     -> event: writeback_complete          |
                               +------------------------------------------+
                                          |
                                          v
                               +----------+----------+
                               | Run Detail (/runs/:id)                    |
                               |                                           |
                               | Status: completed                         |
                               | Confidence: 0.87                          |
                               |                                           |
                               | KB Answer: "Navigate to Settings >        |
                               |  VPN > Reset profile, then..."            |
                               |                                           |
                               | LLM Answer: "Based on common VPN          |
                               |  issues, try these steps..."              |
                               |                                           |
                               | [Select Preferred Answer]                 |
                               | [Approve Writeback to ServiceNow]         |
                               | [Provide Feedback]                        |
                               +------------------------------------------+
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Work Item Submission** | Submit incidents/requests with title, description, classification |
| **Use Case Matching** | Auto-scores prompt against active use cases via keyword overlap |
| **Live Event Streaming** | WebSocket delivers real-time skill execution events to UI |
| **Dual-Answer Mode** | Generates both KB-based and LLM-based answers for comparison |
| **Answer Selection** | User picks preferred answer; choice is tracked for analytics |
| **ServiceNow Trigger** | Can be invoked directly from ServiceNow UI action (popup) |
| **Writeback Approval** | Review and approve before posting resolution back to ServiceNow |
| **Feedback Loop** | Rate outcome (success/fail) with reason (resolved, partial, wrong-doc, etc.) |
| **Run History** | Browse all runs with status, confidence, and timing at /runs |
| **Run Telemetry** | Full event timeline, skill-by-skill breakdown at /runs/:id |
| **Metrics Rollup** | Success rates, confidence trends, doc hit rates feed into admin dashboard |
