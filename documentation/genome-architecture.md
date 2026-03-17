# Application Genome — Architecture & Structure Reference

> **Purpose:** This document describes the current genome system in the OverYonder.ai platform as of March 2026. It is intended as a handoff document for architectural review and standardization work.
>
> **Last updated:** 2026-03-16 — added GenomeGraph structured schema, graph builder service, pipeline integration, debug endpoint, and frontend visualization.

---

## 1. What Is an Application Genome?

An Application Genome is a structured representation of an enterprise application extracted from a source platform (ServiceNow, Salesforce, Jira, Zendesk, Workday). It captures the application's **objects**, **workflows**, **fields**, and **relationships** — enough to understand, compare, cost-analyze, and eventually rebuild the application on a different target platform.

The genome system supports two representations:
- **GenomeDocument** — flat string arrays (backward-compatible, always present)
- **GenomeGraph** — structured graph with field-to-object binding, typed relationships, and workflow decomposition (optional, additive)

---

## 2. Data Model

### 2.1 GenomeDocument (the core structure)

The fundamental unit of genome data. Four string arrays:

```python
class GenomeDocument(BaseModel):
    objects: list[str]          # Entities/tables/catalog items (e.g. "request", "approval", "ticket")
    workflows: list[str]        # Processes/flows (e.g. "request submission", "manager approval")
    fields: list[str]           # Data fields/variables (e.g. "request_id", "priority", "assigned_to")
    relationships: list[str]    # Links between objects (e.g. "request → approval", "ticket → agent")
```

**Current limitations:**
- All four arrays are flat string lists — no nested structure, no types, no metadata per item.
- Relationships are stored as `"A → B"` strings (arrow-separated), not as structured objects with cardinality, type, or direction metadata.
- Fields are not associated with their parent object — they're a flat global list.
- No distinction between custom and standard fields/objects.
- No versioning of the document itself (versioning exists at the artifact level).

### 2.2 GenomeGraph (structured schema — NEW)

**File:** `backend/genome_graph.py`

A rich, graph-oriented representation that addresses the limitations of GenomeDocument. It is **additive** — GenomeDocument remains the backward-compatible format; GenomeGraph is the forward-looking structured format.

```python
class GenomeField(BaseModel):
    id: str                          # Normalized slug (e.g. "request_id")
    name: str                        # Original name
    object_name: str                 # Parent object name (or "global" if unmatched)
    type: str = ""                   # Field type (e.g. "string", "integer")
    required: bool = False
    reference: Optional[str] = None  # Target object if this is a foreign key
    metadata: dict = {}              # Extensible metadata bag

class GenomeRelationship(BaseModel):
    id: str                          # "rel_0", "rel_1", etc.
    source_object: str               # Source object name
    target_object: str               # Target object name
    relationship_type: str = "reference"  # reference, lookup, master-detail, etc.
    cardinality: str = "1:N"         # 1:1, 1:N, N:M

class GenomeWorkflow(BaseModel):
    id: str                          # Normalized slug (e.g. "request_submission")
    name: str                        # Original name
    trigger: str = ""                # What triggers this workflow
    steps: list[str] = []            # Ordered step names

class GenomeObject(BaseModel):
    id: str                          # Normalized slug (e.g. "request")
    name: str                        # Original name
    type: str = "table"              # table, virtual, form, etc.
    fields: list[GenomeField] = []   # Fields owned by this object
    workflows: list[str] = []        # IDs of workflows this object participates in
    relationships: list[str] = []    # IDs of relationships this object participates in

class GenomeGraph(BaseModel):
    objects: list[GenomeObject] = []
    workflows: list[GenomeWorkflow] = []
    relationships: list[GenomeRelationship] = []
```

**Key design decisions:**
- Objects own their fields directly — fields are bound to a parent object, not a global list.
- Workflows and relationships are stored at the top level and referenced by ID from participating objects. This enables traversal from either direction.
- Unmatched fields (those that cannot be mapped to any object) are collected under a synthetic `"global"` object with `type="virtual"`.
- All IDs are normalized slugs (`"Hardware Request"` → `"hardware_request"`).

### 2.3 ApplicationGenome (the top-level record)

```python
class ApplicationGenome(BaseModel):
    id: str                          # "genome_{uuid_hex[:12]}"
    tenant_id: str                   # Multi-tenant scoping
    vendor: str                      # "ServiceNow", "Salesforce", "Jira", "Zendesk", "Workday"
    application_name: str            # Human-readable name (e.g. "Hardware Request")
    source_platform: str             # Source system version (e.g. "ServiceNow Orlando")
    target_platform: str             # Migration target (e.g. "Salesforce Service Cloud")
    category: str = ""               # Domain category (e.g. "IT Service Management")
    object_count: int = 0            # Count of objects in genome_document
    workflow_count: int = 0          # Count of workflows in genome_document
    legacy_cost: float = 0.0         # Annual cost in source system ($)
    migrated_cost: float = 0.0       # Annual cost in target system ($)
    operational_cost: float = 0.0    # Annual operational/maintenance cost ($)
    captured_date: str = ""          # ISO date of capture
    genome_document: GenomeDocument   # Flat genome data (always present, backward-compatible)
    genome_graph: Optional[GenomeGraph] = None  # Structured graph (NEW — optional, additive)
    source_signature: str = ""       # Links back to extraction ID (traceability)
    created_at: datetime             # UTC timestamp
    updated_at: datetime             # UTC timestamp
```

**Key observations:**
- The `GenomeDocument` is embedded directly in the genome record AND stored separately as a `GenomeArtifact`. This is intentional duplication — the embedded copy is for fast access; the artifact is for versioning.
- `genome_graph` is `None` for seed data and pre-existing genomes. New genomes created via the extraction pipeline automatically have a populated graph. The `/graph` debug endpoint can generate one on the fly for any genome.
- `object_count` and `workflow_count` are denormalized summary fields set at creation time.
- Cost fields (`legacy_cost`, `migrated_cost`, `operational_cost`) are manually set — not computed. The seed data has values; worker-created genomes have all zeros.
- `target_platform` and `category` are empty strings for worker-created genomes (set later during migration planning).

### 2.3 GenomeArtifact (versioned genome snapshots)

```python
class GenomeArtifact(BaseModel):
    id: str                          # "gart_{uuid_hex[:12]}"
    genome_id: str                   # FK → ApplicationGenome.id
    version: int = 1                 # Version number for future revision tracking
    artifact_json: dict              # Serialized GenomeDocument (same structure as genome_document)
    created_at: datetime             # UTC timestamp
```

**Notes:**
- Currently only version 1 is ever created. The version field exists to support future re-extraction or mutation tracking.
- `artifact_json` is the `model_dump()` of the `GenomeDocument`.

### 2.4 ExtractionPayload (raw platform data)

```python
class ExtractionPayload(BaseModel):
    id: str                          # "ext_{uuid_hex[:12]}"
    tenant_id: str
    vendor: str                      # "ServiceNow", etc.
    source_platform: str
    application_name: str
    payload: dict                    # Normalized extraction data (NOT raw API response)
    payload_hash: str = ""           # SHA-256 of canonical JSON (deduplication)
    status: str = "pending"          # pending → processing → completed | failed
    error_message: str = ""          # Populated on failure
    genome_id: str = ""              # Populated on successful genome creation
    created_at: datetime
    updated_at: datetime
```

**Important distinction:** The `payload` field does NOT contain the raw ServiceNow API response. It contains the **normalized** output from the adapter — `{tables: [], fields: [], workflows: [], relationships: []}`. The raw API response is not persisted.

---

## 3. Storage Layer

All stores are in-memory (dict-based). The interface is designed for future database migration.

### 3.1 GenomeStore

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(genome: ApplicationGenome) → ApplicationGenome` | |
| `get` | `(genome_id: str) → Optional[ApplicationGenome]` | |
| `list_for_tenant` | `(tenant_id: str) → list[ApplicationGenome]` | Returns all genomes for tenant |
| `delete` | `(genome_id: str) → bool` | |

### 3.2 GenomeArtifactStore

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(artifact: GenomeArtifact) → GenomeArtifact` | |
| `get_by_genome` | `(genome_id: str) → Optional[GenomeArtifact]` | Returns first match (backward compat) |
| `get_latest_by_genome` | `(genome_id: str) → Optional[GenomeArtifact]` | Returns highest version |

### 3.3 ExtractionPayloadStore

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(extraction: ExtractionPayload) → ExtractionPayload` | |
| `get` | `(extraction_id: str) → Optional[ExtractionPayload]` | |
| `list_for_tenant` | `(tenant_id: str) → list[ExtractionPayload]` | Sorted by created_at |
| `list_by_status` | `(status: str) → list[ExtractionPayload]` | Used by worker to poll pending |
| `update` | `(extraction_id: str, **kwargs) → Optional[ExtractionPayload]` | |
| `find_by_payload_hash` | `(payload_hash: str) → Optional[ExtractionPayload]` | Returns first completed/processing match |

---

## 4. API Endpoints

### 4.1 Genomes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/{tenant_id}/genomes` | List all genomes for tenant |
| `GET` | `/api/admin/{tenant_id}/genomes/{genome_id}` | Get genome + latest artifact (includes `genome_graph` if present) |
| `GET` | `/api/admin/{tenant_id}/genomes/{genome_id}/graph` | **NEW** Debug endpoint — returns GenomeGraph only (generates on the fly if not stored) |
| `POST` | `/api/admin/{tenant_id}/genomes` | Create genome + artifact (version 1) |
| `DELETE` | `/api/admin/{tenant_id}/genomes/{genome_id}` | Delete genome |

The GET single endpoint enriches the genome with an `artifact` field containing the latest `GenomeArtifact` (or null). The `genome_graph` field is included in the response — `null` for legacy genomes, populated for new extraction-pipeline genomes.

The `/graph` debug endpoint (temporary, for development validation) returns `{"status": "success", "graph": {...}}`. If the genome has no stored graph, it calls `build_graph_from_document()` to generate one dynamically from the `GenomeDocument`.

### 4.2 Extractions

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/{tenant_id}/extractions` | List extractions (newest first) |
| `GET` | `/api/admin/{tenant_id}/extractions/{extraction_id}` | Get extraction with payload |
| `POST` | `/api/admin/{tenant_id}/extractions` | Create extraction (status=pending) |

---

## 5. Processing Pipeline

### 5.1 End-to-End Flow

```
Raw Platform API Response (e.g. ServiceNow catalog JSON)
        │
        ▼
┌─────────────────────────────────────────┐
│  Adapter: normalize_servicenow_catalog  │  (backend/adapters/)
│  Input:  Raw API JSON                   │
│  Output: {tables, fields, workflows,    │
│           relationships}                │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  ExtractionPayload record created       │  (status="pending")
│  Genome worker notified immediately     │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  Genome Worker (background task)        │  (backend/workers/)
│  1. Poll for status="pending"           │
│  2. Compute SHA-256 hash                │
│  3. Check for duplicates                │
│  4. build_genome_from_extraction()      │
│     → GenomeDocument (flat)             │
│     → GenomeGraph (structured) [NEW]    │
│  5. Create ApplicationGenome            │
│     (with both document and graph)      │
│  6. Create GenomeArtifact (v1)          │
│  7. Update extraction status            │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  ApplicationGenome available via API    │
│  GenomesPage → GenomeDetailPage         │
└─────────────────────────────────────────┘
```

### 5.2 Adapter Layer (ServiceNow-specific)

**File:** `backend/adapters/servicenow_catalog_adapter.py`

The only production adapter today. Normalizes raw ServiceNow catalog API responses into the standard `{tables, fields, workflows, relationships}` format.

**Mapping rules:**
- **tables:** Each catalog item name + each category name
- **fields:** Variable names from catalog items (normalized to `snake_case`)
- **workflows:** `"{item_name} request"` for every item; `"{item_name} approval"` if approval indicators detected
- **relationships:** `"category → item"` and `"item → variables"` links

**Approval detection:** Scans variable names and item descriptions for keywords: `approval`, `authorize`, `manager`, `sign-off`.

**Convenience function:** `create_servicenow_extraction(tenant_id, catalog_name, payload, app)` normalizes + creates extraction + wakes worker in one call.

### 5.3 Genome Builder (vendor-agnostic parsing)

**File:** `backend/services/genome_builder.py`

Pure deterministic function — no LLM calls. Takes the normalized payload and vendor name, returns a `GenomeDocument` with counts, plus a `GenomeGraph` (structured).

The builder now returns:
```python
{
    "genome_document": GenomeDocument,
    "genome_graph": GenomeGraph | None,   # NEW — generated via build_graph_from_document()
    "object_count": int,
    "workflow_count": int,
}
```

If graph generation fails for any reason, `genome_graph` is `None` and the pipeline continues with the flat document only.

**Vendor parsers registered:**

| Vendor | Object Keys | Workflow Keys | Field Keys | Relationship Keys |
|--------|-------------|---------------|------------|-------------------|
| ServiceNow | `tables`, `result[].name` | `workflows`, `flows`, `business_rules`, `flow_definitions` | `fields` (dict/list), `result[].columns` | `references`, `relationships`, `reference_fields` |
| Salesforce | `sobjects`, `objects`, `custom_objects`, `metadata.objects` | `flows`, `process_builders`, `workflows`, `apex_triggers`, `automations` | `fields` (dict/list) | `lookups`, `master_details`, `relationships` |
| Jira | `projects`, `issue_types`, `boards`, `sprints`, `components` | `workflows`, `automations`, `rules` | `fields` (list) | `links`, `relationships` |
| Zendesk | `ticket_forms`, `groups`, `organizations`, `brands`, `objects` | `triggers`, `automations`, `macros`, `workflows` | `ticket_fields`, `user_fields`, `fields` | `relationships` |
| Workday | `business_objects`, `report_definitions`, `domains`, `objects` | `business_processes`, `integrations`, `workflows`, `tasks` | `fields` (list) | `relationships` |
| Generic | All object-like keys | All workflow-like keys | All field-like keys | All relationship-like keys |

**Design characteristics:**
- Handles both string items (`"incident"`) and dict items (`{"name": "incident"}`)
- Relationships accept `"A → B"`, `"A -> B"` (auto-normalized to `→`), or dict with `source/target`, `from/to`
- `_dedupe()` preserves insertion order while removing duplicates
- Vendor dispatch via `_VENDOR_PARSERS` dict — case-insensitive lookup with generic fallback

### 5.4 Genome Graph Builder (document → graph conversion — NEW)

**File:** `backend/services/genome_graph_builder.py`

Pure deterministic function that converts a flat `GenomeDocument` into a structured `GenomeGraph`.

```python
def build_graph_from_document(genome_document: GenomeDocument) -> GenomeGraph
```

**Conversion rules:**

1. **Objects** — Each string in `genome_document.objects` becomes a `GenomeObject` with `id` = normalized slug, `name` = original string.

2. **Fields** — Each string in `genome_document.fields` becomes a `GenomeField` attached to the best-matching object via prefix heuristics:
   - `"request_id"` → matches object `"request"` (prefix match)
   - `"approval_status"` → matches object `"approval"`
   - `"priority"` → no match → assigned to `object_name="global"`
   - Unmatched fields are collected under a synthetic `"global"` object with `type="virtual"`.

3. **Relationships** — Each `"A → B"` or `"A -> B"` string is parsed into a `GenomeRelationship` with `source_object`, `target_object`, `relationship_type="reference"`, `cardinality="1:N"`. Both arrow styles are normalized. Relationship IDs are attached to both participating objects.

4. **Workflows** — Each string becomes a `GenomeWorkflow`. Workflow IDs are attached to objects whose name appears in the workflow name (e.g. `"request submission"` → object `"request"`).

5. **Object linkage** — After conversion, each `GenomeObject` has:
   - `fields`: list of `GenomeField` bound to it
   - `workflows`: list of workflow IDs it participates in
   - `relationships`: list of relationship IDs it participates in

**Field matching heuristics (priority order):**
1. Exact prefix match on underscore-delimited segments: `"request_id"` → `"request"`
2. Progressively shorter prefixes: tries `["cost_center"]`, then `["cost"]`
3. Single-word object name match
4. Fallback: `"global"`

### 5.5 Genome Worker (async background processor)

**File:** `backend/workers/genome_worker.py`

**Configuration (env vars):**
- `GENOME_WORKER_INTERVAL_SECONDS` — poll interval (default: 30s)
- `GENOME_WORKER_BATCH_CONCURRENCY` — parallel extractions per poll (default: 5)

**Lifecycle:**
1. Started as `asyncio.Task` in FastAPI startup
2. Polls `extraction_store.list_by_status("pending")` every interval
3. Processes batches in parallel via `asyncio.gather()`

**Deduplication:**
- Computes SHA-256 of canonical payload JSON (`json.dumps(payload, sort_keys=True)`)
- If matching hash found with status `completed` or `processing`, skips and links to existing genome

**Fields set by worker on new genomes:**
- `target_platform`: `""` (empty — set later)
- `category`: `""` (empty — set later)
- `captured_date`: Today's ISO date
- `source_signature`: Extraction ID
- `legacy_cost`, `migrated_cost`, `operational_cost`: `0` (set later)

---

## 6. Seed Data (Demo Setup)

Six pre-built genomes seeded for the "acme" tenant with stable IDs:

| ID | Application | Vendor | Source → Target | Objects | Workflows | Legacy$ | Migrated$ |
|----|------------|--------|-----------------|---------|-----------|---------|-----------|
| `genome_hw_request` | Hardware Request | ServiceNow | Orlando → Salesforce SC | 347 | 89 | $125k | $85k |
| `genome_access_req` | Access Request | ServiceNow | Paris → Okta Workflows | 234 | 56 | $98k | $62k |
| `genome_case_mgmt` | Case Management | Salesforce | Service Cloud → Zendesk | 189 | 42 | $110k | $72k |
| `genome_bug_tracker` | Bug Tracker | Jira | Cloud → Azure DevOps | 95 | 28 | $45k | $32k |
| `genome_onboarding` | Employee Onboarding | Workday | HCM → SAP SF | 278 | 65 | $155k | $98k |
| `genome_helpdesk` | Helpdesk Ticketing | Zendesk | Support → Freshdesk | 142 | 35 | $68k | $48k |

Each has a corresponding `GenomeArtifact` (version 1) with the serialized `GenomeDocument`.

---

## 7. Frontend

### 7.1 Pages Using API (connected)

**GenomesPage** (`/genomes`):
- Fetches from `GET /api/admin/acme/genomes`
- Displays table with 11 columns (name, vendor, platforms, counts, costs, dates)
- Row click navigates to detail page
- "+ Capture Genome" button links to capture wizard

**GenomeDetailPage** (`/genomes/:id`):
- Fetches from `GET /api/admin/acme/genomes/{id}` and `GET /api/admin/acme/genomes/{id}/graph`
- 7 sections:
  1. Header (vendor icon, name, platforms, action buttons)
  2. Application Overview (6 cards)
  3. Cost Profile (3 cards with savings calculation)
  4. Structural Genome — flat view (objects/workflows/fields/relationships as string lists from GenomeDocument)
  5. **Genome Graph — structured view (NEW)**: collapsible section showing:
     - Summary badge: object count, relationship count, workflow count
     - Object cards in a 3-column grid, each expandable to show:
       - Bound fields with type/required/reference indicators
       - Linked workflows resolved by name
       - Linked relationships with source → target and cardinality
     - Virtual `"global"` object highlighted in amber for unmatched fields
     - All Relationships summary grid with cardinality badges
     - All Workflows summary grid with trigger badges
  6. Genome Artifact (collapsible JSON viewer with Copy/Download)
  7. Raw Genome Artifact (collapsible full genome JSON)
- Action buttons: Export, Rebuild, Delete

### 7.2 Pages Using Mock Data (not connected)

**GenomeInsightsPage** (`/genomes/insights`):
- Imports from `mockGenomes.ts`
- Analytics dashboard: vendor distribution donut chart, workflow complexity buckets, migration savings bars, cost comparison table

**GenomeCapturePage** (`/genomes/capture`):
- 5-step wizard: Source Platform → Application Type → Configure → Preview → Confirm
- Platform selection: ServiceNow, Salesforce, Jira, Zendesk, Workday
- Application types: Catalog Item, Workflow, Table Application, Custom App
- Preview step uses `mockGenomes[0]` — not connected to extraction API

### 7.3 Frontend Types

```typescript
interface GenomeDocumentResponse {
    objects: string[];
    workflows: string[];
    fields: string[];
    relationships: string[];
}

// --- GenomeGraph types (NEW) ---

interface GenomeFieldResponse {
    id: string;
    name: string;
    object_name: string;
    type: string;
    required: boolean;
    reference: string | null;
    metadata: Record<string, unknown>;
}

interface GenomeRelationshipResponse {
    id: string;
    source_object: string;
    target_object: string;
    relationship_type: string;
    cardinality: string;
}

interface GenomeWorkflowResponse {
    id: string;
    name: string;
    trigger: string;
    steps: string[];
}

interface GenomeObjectResponse {
    id: string;
    name: string;
    type: string;
    fields: GenomeFieldResponse[];
    workflows: string[];       // IDs referencing GenomeWorkflowResponse
    relationships: string[];   // IDs referencing GenomeRelationshipResponse
}

interface GenomeGraphResponse {
    objects: GenomeObjectResponse[];
    workflows: GenomeWorkflowResponse[];
    relationships: GenomeRelationshipResponse[];
}

// --- Main genome response ---

interface GenomeResponse {
    id: string;
    tenant_id: string;
    vendor: string;
    application_name: string;
    source_platform: string;
    target_platform: string;
    category: string;
    object_count: number;
    workflow_count: number;
    legacy_cost: number;
    migrated_cost: number;
    operational_cost: number;
    captured_date: string;
    genome_document: GenomeDocumentResponse;
    genome_graph?: GenomeGraphResponse | null;  // NEW
    source_signature: string;
    created_at: string;
    updated_at: string;
    artifact?: GenomeArtifactResponse | null;
}

// --- API functions ---
getGenomes(tenantId: string): Promise<GenomeResponse[]>
getGenome(tenantId: string, genomeId: string): Promise<GenomeResponse>
getGenomeGraph(tenantId: string, genomeId: string): Promise<{status: string, graph: GenomeGraphResponse}>  // NEW
```

---

## 8. Integration Points

### 8.1 ServiceNow-to-Replit Flow
After fetching a ServiceNow catalog, `create_servicenow_extraction()` is called to feed the raw catalog into the genome pipeline. The extraction runs in parallel with the LLM prompt generation — non-blocking.

### 8.2 ServiceNow-to-GitHub Flow
Same genome extraction trigger — added in the latest commit. When Phase 2 fetches the full catalog payload, it calls `create_servicenow_extraction()` before building the GitHub export files.

### 8.3 Manual Extraction API
`POST /api/admin/{tenant_id}/extractions` allows direct payload submission. The worker picks it up on the next poll.

---

## 9. Known Gaps & Architectural Notes

### Addressed by GenomeGraph (new)

1. ~~**Flat string arrays**~~ — **Addressed.** `GenomeGraph` provides structured objects with typed fields, metadata, and cardinality. `GenomeDocument` is retained for backward compatibility.

2. ~~**Fields not linked to objects**~~ — **Addressed.** `GenomeGraph` binds fields to parent objects via `GenomeField.object_name`. Unmatched fields go to a `"global"` virtual object.

3. ~~**Relationships are strings**~~ — **Addressed.** `GenomeRelationship` has `source_object`, `target_object`, `relationship_type`, and `cardinality` fields.

### Remaining gaps

4. **No re-extraction or diffing** — No mechanism to re-extract and compare changes over time. Artifact versioning exists but isn't used.

5. **Cost data is manual** — Not computed from any source; set to 0 by the worker and manually populated in seed data.

6. **Two frontend pages still use mock data** — GenomeInsightsPage and GenomeCapturePage import from `mockGenomes.ts` instead of the API.

7. **Only one production adapter** — ServiceNow. Other vendor parsers exist in `genome_builder.py` but have no corresponding adapters to normalize raw API responses.

8. **Raw API response not stored** — The adapter normalizes before persisting. The original API payload is lost after extraction creation.

9. **No update endpoint** — Genomes can be created and deleted but not updated via API.

10. **Worker-created genomes have empty metadata** — `target_platform`, `category`, and all cost fields are empty/zero. No UI to set them post-creation.

11. **Seed data genomes have no stored graph** — The 6 demo genomes were created before the graph builder was integrated. They return `genome_graph: null` from the API. The `/graph` debug endpoint generates one on the fly. A backfill migration could populate them.

12. **Field matching is heuristic** — The graph builder uses prefix-based matching to assign fields to objects. Fields like `"priority"` or `"quantity"` that don't share a prefix with any object name end up in `"global"`. Richer source data (e.g. ServiceNow's variable-to-item association) could improve accuracy.

13. **GenomeGraph not yet used for migration planning** — The graph is currently display-only. Future work: use the graph for automated migration mapping, diff comparisons, and rebuild orchestration.

---

## 10. File Inventory

| File | Purpose |
|------|---------|
| `backend/models.py` | `GenomeDocument`, `ApplicationGenome` (with `genome_graph` field), `GenomeArtifact`, `ExtractionPayload` |
| `backend/genome_graph.py` | `GenomeField`, `GenomeRelationship`, `GenomeWorkflow`, `GenomeObject`, `GenomeGraph` (NEW) |
| `backend/services/genome_builder.py` | Vendor-agnostic extraction → GenomeDocument + GenomeGraph |
| `backend/services/genome_graph_builder.py` | `build_graph_from_document()` — GenomeDocument → GenomeGraph converter (NEW) |
| `backend/workers/genome_worker.py` | Async background processor — now creates both document and graph |
| `backend/adapters/servicenow_catalog_adapter.py` | ServiceNow catalog normalization + extraction creation |
| `backend/routers/genomes.py` | CRUD + `/graph` debug endpoint |
| `backend/routers/extractions.py` | Extraction CRUD |
| `backend/store/interface.py` | Store interfaces |
| `backend/store/memory.py` | In-memory store implementations |
| `backend/bootstrap/demo_setup.py` | Seed data (6 genomes, no graph) |
| `src/app/services/api.ts` | Frontend API client + GenomeGraph types |
| `src/app/pages/GenomeDetailPage.tsx` | Detail page with GenomeGraph visualization (NEW) |
| `src/app/pages/GenomesPage.tsx` | Genome list page |
| `src/app/pages/GenomeInsightsPage.tsx` | Analytics (still uses mock data) |
| `src/app/pages/GenomeCapturePage.tsx` | Capture wizard (still uses mock data) |
| `src/app/data/mockGenomes.ts` | Mock genome data for unconnected pages |
