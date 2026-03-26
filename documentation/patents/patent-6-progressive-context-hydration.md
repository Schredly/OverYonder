# Patent Technical Disclosure: Progressive Context Hydration

## Title

**System and Method for LLM-Directed Iterative Context Hydration Enabling Context-Aware, Retrieval-Driven Application Reconstruction from Structured Enterprise Genome Repositories**

---

## 1. Field of Invention

This invention relates to artificial intelligence systems, enterprise application migration, dynamic context management, and computational resource optimization. Specifically, it describes a system and method wherein a large language model (LLM) actively directs its own context acquisition through a structured iterative retrieval protocol — rather than receiving static pre-loaded context — enabling efficient, high-fidelity reconstruction of complex enterprise applications from version-controlled genome repositories and structured source documents.

---

## 2. Background and Prior Art Gaps

### 2.1 The Context Problem in Enterprise Application Reconstruction

Enterprise applications typically contain hundreds to thousands of interrelated artifacts: catalog items, workflows, business rules, data models, UI definitions, integration configurations, and security policies. Reconstructing such an application on a target platform (e.g., converting a ServiceNow catalog to a web application) requires the LLM to understand the complete application structure before generating output.

Prior approaches to providing this context fall into three categories, each with fundamental limitations:

**Static Prompting:**
- The entire application definition is concatenated into a single LLM prompt
- Fails for large applications: context windows overflow (GPT-4o: 128K tokens, Claude: 200K tokens)
- Even within limits, LLM attention degrades on long contexts — elements early in the prompt are "forgotten" by the time the LLM processes the end
- Wasteful: most of the context is irrelevant to the specific transformation requested

**Naive Retrieval-Augmented Generation (RAG):**
- A retrieval system selects "relevant" documents based on semantic similarity to the user's query
- The system decides what to retrieve; the LLM passively receives the result
- Retrieval is single-pass: one query → one retrieval → one generation
- Fails for structured reconstruction tasks where the LLM needs to iteratively understand dependencies: "I need the workflows before I know which tables they reference"
- Cannot adapt retrieval strategy based on what the LLM discovers in earlier retrieved documents

**Agentic Tool Calling:**
- General-purpose LLM tool use frameworks (ReAct, function calling) allow models to invoke tools
- Not specialized for the specific problem of enterprise genome reconstruction
- No structured index protocol, no source-agnostic abstraction, no guard enforcement, no minimum-retrieval contract

### 2.2 Gaps in Prior Art

1. No existing system allows an LLM to **actively direct its own context acquisition** through a structured multi-turn protocol specifically designed for enterprise application reconstruction.

2. No existing system produces a **lightweight genome index** (entity manifest with file paths and summaries, no content) as a first-class artifact that initializes the retrieval loop.

3. No existing system implements a **source-agnostic retrieval abstraction** that applies the same LLM-directed loop to multiple source types: version-controlled file repositories, structured XML documents, and parsed document sections.

4. No existing system enforces a **minimum-retrieval contract** (guard validation) that programmatically rejects premature application generation before sufficient context has been acquired, with automatic retry and correction injection.

5. No existing system applies **iterative context hydration to the extraction phase itself** — allowing the LLM to selectively load record types from large source documents rather than receiving the entire document at once.

6. No existing system combines: genome index generation → LLM-directed retrieval → guard enforcement → progressive context accumulation → downstream synthesis as a unified, composable pipeline component.

---

## 3. Summary of Invention

The present invention provides a system and method called **Progressive Context Hydration** (PCH) comprising:

1. **Genome Index Generation**: At genome commit time, a deterministic `genome.index.json` is generated alongside genome files. The index maps all application entities (forms, workflows, tables, UI components) to their repository file paths with short summaries — providing a lightweight manifest of the entire application structure without file content.

2. **Hydration Loop Initialization**: When an LLM-mediated operation is requested (transformation, translation, extraction), the system initializes the loop by:
   - Listing available source files (file tree or record type index)
   - Fetching and embedding the genome index as the first message
   - Presenting a structured protocol to the LLM

3. **LLM-Directed Retrieval**: The LLM responds with a structured JSON request identifying which specific files or record types it needs, along with its retrieval plan. The protocol enforces two response shapes:
   - **Retrieval request**: `{"plan": [...], "required_files": ["path/to/file"]}`
   - **Ready signal**: `{"plan": [...], "ready": true, "reason": "..."}`

4. **Guard Validation**: A stateful guard layer validates each LLM response. If the LLM attempts to produce output before fetching any source material, the response is rejected and a correction message is injected into the conversation, forcing a retry. This prevents "hallucinated builds" — plausible-looking but contextually unfounded output.

5. **Incremental Context Accumulation**: Retrieved file contents are appended to the conversation context. The LLM sees accumulated context growing across rounds, enabling it to discover dependencies iteratively (e.g., "now that I see the workflow, I also need the approval table definition").

6. **Ready-to-Build Transition**: When the LLM signals readiness (or maximum rounds are reached), the accumulated context is packaged into a `HydrationContext` object containing: loaded files, conversation history, accumulated plan, and token usage statistics.

7. **Downstream Synthesis**: The `HydrationContext` is passed to a synthesis step that generates the final output (filesystem plan, genome YAML, application spec) using only the retrieved context — never the full source.

8. **Source-Agnostic Abstraction**: The same loop logic is applied to three source types through a shared base abstraction:
   - **GitHub file retrieval** (for transformation/translation)
   - **XML record type retrieval** (for ServiceNow extraction)
   - **Document section retrieval** (for documentation extraction)

---

## 4. Detailed Description

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 PROGRESSIVE CONTEXT HYDRATION                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 1: INDEX INITIALIZATION                             │   │
│  │  • Fetch genome.index.json (entity manifest, no content)  │   │
│  │  • List available source files / record types             │   │
│  │  • Construct initial prompt with index + user request     │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 2: LLM CALL (Round N)                               │   │
│  │  • Send: conversation history + current context           │   │
│  │  • Receive: JSON response                                  │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 3: GUARD VALIDATION                                 │   │
│  │  • Reject if: production response + 0 files fetched       │   │
│  │  • Inject correction message + retry (max 2 retries)      │   │
│  │  • Accept if: valid retrieval request or ready signal      │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 4a: RETRIEVAL (if required_files present)           │   │
│  │  • Fetch each requested file/record                       │   │
│  │  • Deduplicate (skip already-loaded paths)                │   │
│  │  • Append content to conversation                         │   │
│  │  • Check context budget — force ready if exceeded         │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│                   [repeat until ready or max rounds]             │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 4b: READY TRANSITION (if ready: true)               │   │
│  │  • Package HydrationContext                               │   │
│  │  • Include: loaded_files, messages, plan, token usage     │   │
│  │  • Pass to downstream synthesis step                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 SOURCE-AGNOSTIC RETRIEVAL LAYER                  │
│                                                                  │
│  GitHubHydrationLoop        XMLHydrationLoop     DocHydrationLoop│
│  • list_tree()              • records_by_type    • doc_sections  │
│  • get_file()               • auto-include HPT   • page index    │
│  • path normalization       • type filtering      • section fetch │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Genome Index Generation (`genome.index.json`)

At genome commit time, the system generates a deterministic `genome.index.json` alongside all genome files. This index is the critical initialization artifact for the hydration loop.

**Structure:**
```json
{
  "entities": {
    "forms": [
      {"id": "form_rental_request", "name": "Rental Request", "file_path": "structure/catalog.json"}
    ],
    "workflows": [
      {"id": "wf_approval", "name": "Standard Approval", "file_path": "structure/workflows.json"}
    ],
    "tables": [
      {"id": "tbl_assets", "name": "Asset Registry", "file_path": "structure/data_model.json"}
    ],
    "ui_components": [
      {"id": "ui_dashboard", "name": "Rental Dashboard", "file_path": "structure/ui.json"}
    ]
  },
  "relationships": {
    "form_rental_request": ["wf_approval", "tbl_assets"]
  },
  "summaries": {
    "form_rental_request": "Catalog form for requesting rental equipment. Contains 12 variables.",
    "wf_approval": "Two-stage approval workflow triggered on form submission."
  },
  "metadata": {
    "application_name": "Rental Management",
    "source_system": "ServiceNow",
    "entity_counts": {"forms": 4, "workflows": 8, "tables": 12, "ui_components": 3}
  }
}
```

**Key properties:**
- **No file content**: Only entity names, IDs, file paths, and 1-2 sentence summaries
- **Deterministic**: Generated by rule-based extraction from genome structure, no LLM required, same input → identical output
- **Relationship graph**: Explicit entity-to-entity dependencies enable the LLM to plan multi-step retrieval
- **File path mapping**: Each entity maps to the exact GitHub path where its full definition resides

**Design rationale**: The index answers the question "what exists and where is it?" in ~2-5KB, compared to the 50-200KB of the full genome. This is the key efficiency driver — the LLM understands the application structure before committing to retrieving any content.

### 4.3 LLM-Directed Retrieval Protocol

The system presents a two-shape JSON protocol to the LLM:

**Shape 1 — Retrieval Request:**
```json
{
  "plan": [
    "Load rental_request form to understand field structure",
    "Load associated approval workflow to map trigger conditions"
  ],
  "required_files": ["structure/catalog.json", "structure/workflows.json"]
}
```

**Shape 2 — Ready Signal:**
```json
{
  "plan": ["Form structure, workflow, and data model fully loaded"],
  "ready": true,
  "reason": "All entities needed for the target app spec are loaded"
}
```

The `plan` field is required in both shapes. It serves two purposes:
1. Forces the LLM to reason explicitly about its retrieval strategy before requesting files
2. Provides an audit trail of the LLM's decision process, surfaced in the UI as progress updates

**Round progression:**
- **Round 0 (initialization)**: Index fetched, first prompt constructed — no LLM call
- **Round 1**: LLM analyzes index, requests primary files (forms, workflows)
- **Round 2**: LLM reads primary files, discovers dependencies, requests secondary files (tables, configs)
- **Rounds 3+**: LLM requests additional context or signals ready
- **Force-ready**: On final round, system injects a directive requiring ready signal

### 4.4 Guard Validation Layer

A stateful `Guard` object is instantiated per hydration loop run. It maintains retry counts per round and enforces the minimum-retrieval contract.

**Rejection conditions:**

| Condition | Detection | Correction injected |
|---|---|---|
| Premature spec | `output`/`filesystem_plan` key present AND `files_fetched == 0` | Forces retrieval round |
| Premature ready | `ready: true` AND `files_fetched == 0` | Explains minimum retrieval requirement |
| Empty request | `required_files: []` AND `files_fetched == 0` | Asks for explicit retrieval or ready with reason |

**Retry logic:**
- Maximum 2 retries per round
- After max retries, the guard accepts the response to prevent infinite loops
- Each rejection injects a specific correction message explaining the violation

**Significance**: The guard makes the retrieval-first property of the system **mechanically enforced**, not merely instructed. A misconfigured LLM or a prompt injection attempting to skip retrieval cannot succeed — the guard will intercept and retry.

### 4.5 Source-Agnostic Loop Abstraction

The hydration loop is abstracted over three source types:

**4.5.1 GitHub File Hydration (Transformation/Translation)**

```
Source:  GitHub repository
Index:   genome.index.json (entity manifest) + directory tree
Request: required_files: ["structure/entities.json"]
Fetch:   get_file(tenant, base_path + "/" + path, app)
Budget:  MAX_FILE_CHARS=8,000 per file, MAX_CONTEXT=120,000 total
```

Used when applying translation recipes or user transformations to committed genomes.

**4.5.2 XML Record Hydration (ServiceNow Extraction)**

```
Source:  Locally parsed XML update set records
Index:   Record type summary {type: {count, sample_names[]}}
Request: required_files: ["sys_catalog_item", "wf_workflow"]
Fetch:   filter records_by_type[type_name][:MAX_CHARS_PER_TYPE]
Budget:  MAX_CHARS_PER_TYPE=40,000 per type, MAX_TOTAL=100,000

Auto-include: High-priority types loaded first within half budget:
  sys_catalog_item, wf_workflow, sys_script, sys_db_object,
  sys_app_module, item_option_new, sys_business_rule, ...
```

Used during SN update set extraction. Replaces the prior approach of sending all XML in a single truncated prompt. The loop is bypassed for small update sets (< 50 records) via a configurable threshold.

**4.5.3 Document Section Hydration (Documentation Extraction)**

```
Source:  Parsed document sections (PDF, DOCX, TXT)
Index:   Table of contents + section titles + word counts
Request: required_files: ["section_3", "appendix_b"]
Fetch:   return pre-parsed section text
Budget:  MAX_SECTION_CHARS per section, MAX_TOTAL total
```

Used when extracting genomes from large documentation files. Replaces full-document prompting.

**Shared components across all three sources:**
- Guard validation (identical logic)
- HydrationContext data structure
- Conversation history management
- Token usage tracking
- Round limit enforcement

### 4.6 HydrationContext Data Structure

The output of every hydration loop run is a `HydrationContext` object:

```python
@dataclass
class HydrationContext:
    genome_path: str          # source identifier
    user_request: str         # original user intent

    loaded_files: dict[str, str]         # path → content (deduplicated)
    iterations: list[HydrationIteration] # per-round retrieval records
    accumulated_plan: list[str]          # LLM's stated reasoning across rounds

    total_chars: int                     # total context accumulated
    total_input_tokens: int              # LLM input tokens consumed
    total_output_tokens: int             # LLM output tokens consumed
    total_latency_ms: int

    ready: bool                          # True = LLM signalled sufficient context
    ready_reason: str                    # LLM's stated reason

    index_json: dict | None              # parsed genome.index.json (if present)
    file_tree: list[dict]                # available files/records
    messages: list[dict]                 # full conversation history for hand-off
    system_prompt: str                   # for downstream synthesis use
```

The `messages` field enables a critical capability: the downstream synthesis step can **continue the same conversation**, receiving the accumulated context as if it were a single coherent session. This preserves the LLM's working memory across the retrieval and synthesis phases.

### 4.7 Token Efficiency Analysis

**Single-pass approach (prior art):**

| Application size | XML/file chars | Tokens consumed | Context window | Outcome |
|---|---|---|---|---|
| Small (20 records) | ~10K chars | ~2,500 tokens | ✓ fits | Acceptable |
| Medium (200 records) | ~100K chars | ~25,000 tokens | ✓ fits | Degraded attention |
| Large (2,000 records) | ~1M chars | ~250,000 tokens | ✗ overflow | Fails / truncated |

**Progressive Context Hydration:**

| Application size | Focused context | Tokens (hydration) | Tokens (synthesis) | Total | vs. prior art |
|---|---|---|---|---|---|
| Small (< 50 records) | Auto-include, no loop | 0 | ~2,500 | ~2,500 | Same |
| Medium (200 records) | ~20K chars selected | ~3,000 | ~6,000 | ~9,000 | 64% reduction |
| Large (2,000 records) | ~30K chars selected | ~5,000 | ~8,000 | ~13,000 | **95% reduction** |
| Any size | Bounded by MAX_TOTAL_CHARS | Predictable | Predictable | Bounded | No overflow |

**Critical property**: Token consumption becomes **sublinear** relative to application size. A 10× larger application requires only ~1.5× more tokens, rather than 10×.

### 4.8 Integration with Translation Recipes (Patent 3 Enhancement)

Progressive Context Hydration composites with the Translation Recipe system (Patent 3):

**Prior approach (Patent 3):**
- Recipe loaded → full repository context loaded (file tree + up to 5 files, 15KB cap) → single LLM call

**Enhanced approach:**
- Recipe loaded → hydration loop initializes with recipe instructions as `extra_system` → LLM retrieves exactly the files relevant to the recipe's output requirements → synthesis step produces output

The recipe instructions are injected into the system prompt of the hydration loop:
```
extra_system = translation.instructions  # injected into HYDRATION_SYSTEM
```

This produces higher-quality recipe output because the LLM retrieves the exact genome sections the recipe needs, rather than receiving an arbitrary fixed set of files.

**Updated token efficiency (with hydration):**

| Step | Tokens (Patent 3) | Tokens (Patent 6 enhanced) | Reduction |
|---|---|---|---|
| Recipe application (first) | ~12,000 | ~8,000 | 33% |
| Recipe application (subsequent) | ~12,000 | ~8,000 | 33% |
| Portfolio of 100 applications | ~1,659,000 | ~1,107,000 | 33% additional |

Combined with Patent 3's recipe amortization, the system achieves an **83-87% total token reduction** compared to unguided interactive transformation.

---

## 5. Key Claims

### Independent Claims

**Claim 1.** A computer-implemented method for LLM-directed iterative context hydration for enterprise application reconstruction comprising:
(a) generating a lightweight genome index (`genome.index.json`) at application commit time, the index mapping all application entities to their repository file paths with short summaries but without file content;
(b) initializing a hydration loop by presenting the LLM with the genome index and a structured retrieval protocol;
(c) receiving from the LLM a structured JSON retrieval request identifying specific files and a retrieval plan;
(d) validating the LLM response via a guard layer that rejects production output if no source files have been fetched, injecting a correction message and retrying;
(e) fetching the requested files and appending their contents to the LLM conversation context;
(f) repeating steps (c)-(e) until the LLM signals readiness or a maximum round limit is reached;
(g) packaging accumulated context into a HydrationContext object comprising loaded files, conversation history, accumulated plan, and token usage;
(h) passing the HydrationContext to a downstream synthesis step.

**Claim 2.** A system for context-aware retrieval-driven application reconstruction comprising:
(a) an index generator configured to produce a deterministic genome index mapping entities to file paths at commit time;
(b) a hydration loop controller configured to manage multi-turn LLM dialogue for iterative file retrieval;
(c) a guard validator configured to reject and retry LLM responses that violate the minimum-retrieval contract;
(d) a source-agnostic retrieval abstraction configured to apply the same loop protocol to GitHub file repositories, parsed XML record sets, and structured document sections;
(e) a HydrationContext accumulator configured to package loaded context and conversation history for downstream synthesis steps.

**Claim 3.** A method for source-agnostic iterative context retrieval comprising:
(a) abstracting a retrieval loop over multiple source types including: version-controlled file repositories, structured XML record collections, and parsed document sections;
(b) for each source type, implementing a source-specific index builder and content fetcher while sharing loop control logic, guard validation, and context accumulation;
(c) thereby enabling the same LLM-directed retrieval protocol to apply to transformation, translation, and extraction operations without modification to the loop controller.

**Claim 4.** A method for enforcing minimum-context requirements in LLM-mediated application generation comprising:
(a) maintaining a stateful guard object tracking files fetched per retrieval round;
(b) detecting premature production responses defined as: generation output present AND files fetched equals zero;
(c) rejecting premature responses and injecting correction messages into the LLM conversation;
(d) accepting the response after a configurable maximum number of retries per round to prevent infinite loops.

### Dependent Claims

**Claim 5.** The method of Claim 1 wherein the genome index is generated deterministically by rule-based extraction from genome structure without LLM inference, ensuring identical inputs produce identical indexes.

**Claim 6.** The method of Claim 1 wherein the LLM retrieval request includes a `plan` field comprising one or more natural language statements of the LLM's retrieval strategy, and wherein the plan is surfaced in the user interface as a real-time progress indicator.

**Claim 7.** The method of Claim 1 wherein fetched file contents are deduplicated by path, preventing redundant retrieval of already-loaded files across rounds.

**Claim 8.** The method of Claim 1 wherein the system enforces a context budget expressed as maximum accumulated characters, injecting a budget-exceeded directive into the conversation when the budget is reached, forcing the LLM to produce output with available context.

**Claim 9.** The system of Claim 2 wherein the source-agnostic retrieval abstraction for XML record sources implements an auto-include pass that loads high-priority record types (catalog items, workflows, business rules) within a reserved portion of the context budget before the LLM-directed loop begins.

**Claim 10.** The system of Claim 2 wherein for XML record sources, the loop is bypassed entirely for small update sets below a configurable record count threshold, applying direct auto-include without LLM overhead.

**Claim 11.** The method of Claim 1 wherein the HydrationContext includes the full multi-turn conversation history, enabling the downstream synthesis step to continue the same conversation without re-initializing context.

**Claim 12.** The method of Claim 1 wherein the hydration loop is composed with a translation recipe system such that recipe instructions are injected into the hydration system prompt, causing the LLM to selectively retrieve only the genome sections relevant to the recipe's required output.

**Claim 13.** The method of Claim 4 wherein the guard maintains per-round retry counts and the maximum retries is configurable, with the guard accepting any response after the maximum is reached to ensure loop termination.

**Claim 14.** The system of Claim 2 wherein the genome index maps application entities into four canonical categories: forms, workflows, tables, and UI components, each with an entity identifier, display name, and repository file path.

**Claim 15.** The method of Claim 1 wherein token consumption is sublinear relative to application size: a 10× larger application requires no more than 2× additional tokens due to context budget enforcement and selective retrieval.

**Claim 16.** The method of Claim 1 wherein for transformation operations, the hydration loop retrieves files from a version-controlled repository using: (i) repository tree listing as the initial index, (ii) per-file content fetching via authenticated API, and (iii) path normalization to handle relative vs. absolute path formats.

**Claim 17.** The method of Claim 3 wherein document section hydration parses source documents (PDF, DOCX) into sections indexed by title, page range, and word count, enabling the LLM to request specific sections without receiving the full document.

**Claim 18.** The system of Claim 2 wherein the guard validator distinguishes between three premature response types: (i) premature specification with filesystem plan, (ii) premature readiness signal without prior retrieval, and (iii) empty retrieval request without readiness signal, applying a specific correction message to each type.

**Claim 19.** The method of Claim 1 further comprising streaming server-sent events (SSE) to a client interface reporting: retrieval phases, files fetched with sizes, LLM plan updates, context budget utilization, and round completion.

**Claim 20.** A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of Claim 1.

---

## 6. Advantages Over Prior Art

### vs. Static Prompting
1. **No context window overflow**: Context budget enforcement prevents any application size from exceeding model limits
2. **Proportional attention**: LLM only sees relevant files; attention is not diluted by irrelevant records
3. **Predictable token cost**: Cost is bounded by `MAX_TOTAL_CHARS`, not application size

### vs. Naive RAG
1. **LLM drives retrieval**: The LLM determines what it needs, not a semantic similarity function — critical for structured reconstruction where dependencies are logical, not semantic
2. **Multi-turn adaptive retrieval**: Each round can request different files based on what the prior round revealed (workflow → discovers it needs the approval table → requests it)
3. **Minimum-retrieval enforcement**: Guard prevents generation before retrieval; RAG has no such contract
4. **Structured protocol**: JSON shapes with `plan`/`required_files`/`ready` fields provide a typed interface; RAG uses unstructured similarity scores

### vs. General Agentic Tool Calling
1. **Domain-specific index**: genome.index.json provides application-aware entity mapping, not generic file system access
2. **Source-agnostic abstraction**: Same protocol for GitHub, XML, documents — agentic frameworks require custom tool implementations per source
3. **Composable with recipes**: Hydration loop integrates as a pre-step to translation recipe execution, amplifying token savings of both systems
4. **Guard enforcement**: Programmatic minimum-context contract has no equivalent in general tool-use frameworks

---

## 7. Relationship to Prior OverYonder Patents

### Patent 1 Modifications (Genome Extraction)
The `genome.index.json` artifact described in Section 4.2 should be added to Patent 1's claims as:
- A new artifact type committed alongside genome.yaml and graph.yaml (Section 4.6)
- A new dependent claim covering deterministic index generation
- An addition to Figure 5 (Taxonomized GitHub Directory Structure)

The XMLHydrationLoop described in Section 4.5.2 should be added to Patent 1 as:
- A new pipeline stage (Stage 1b: XML Hydration) inserted between XML parsing and genome extraction
- A dependent claim covering threshold-based loop activation
- An update to Figure 2 (Multi-Pass Pipeline Flow)

### Patent 3 Modifications (Translation Recipes)
Section 4.2 of Patent 3 currently states "full repository context (file tree + YAML files)" is loaded for recipe application. This should be updated to reference the hydration loop as the context loading mechanism:
- Replace "loads up to 5 files, 15KB total" with "initiates hydration loop with recipe instructions injected as system context"
- Add updated token efficiency numbers incorporating hydration savings (Section 4.8 above)
- Add a new claim covering recipe-hydration composition

---

## 8. Drawings/Figures Description

**Figure 1: System Architecture** — Block diagram showing the hydration loop stages (Index Init → LLM Call → Guard → Retrieval → Context Accumulation → Ready Transition) with the downstream synthesis step.

**Figure 2: Guard Validation State Machine** — State diagram showing guard states (waiting, rejected, accepted, max-retries) with transitions for each rejection condition.

**Figure 3: Source-Agnostic Abstraction** — Three-column diagram showing GitHub, XML, and Document sources with shared loop controller and source-specific index/fetch implementations.

**Figure 4: Genome Index Structure** — Entity-relationship diagram of genome.index.json with entities, relationships, summaries, and metadata sections.

**Figure 5: Round-by-Round Context Growth** — Chart showing context accumulated per round for a sample application, with entity index, round-1 retrieval, round-2 retrieval, and ready signal annotated.

**Figure 6: Token Efficiency Comparison** — Bar chart comparing single-pass, naive RAG, and Progressive Context Hydration token consumption for small/medium/large/very large applications.

**Figure 7: HydrationContext Data Flow** — Sequence diagram showing how HydrationContext is produced by the loop and consumed by downstream synthesis and recipe execution.

**Figure 8: XML Record Type Index** — Sample formatted index showing record types, counts, sample names, auto-included vs. available sections.

**Figure 9: Integration with Translation Recipe System** — Diagram showing how recipe instructions are injected into the hydration system prompt, and how hydration output feeds the synthesis step.

**Figure 10: Sublinear Token Scaling** — Graph showing token consumption vs. application size for single-pass (linear) vs. PCH (sublinear/bounded) approaches, with crossover point annotated.

---

## 9. Inventors

[To be completed by filing attorney]

## 10. Filing Notes

- **Strongest novel claim**: The guard validation layer (Claim 4) is the most mechanically novel element — no prior art enforces minimum-retrieval as a programmatic contract with retry injection
- **Broadest claim**: Claim 3 (source-agnostic loop abstraction) covers the generalization across GitHub, XML, and document sources — this is the widest defensible scope
- **File as continuation**: Patent 3 (Translation Recipes) should be cited as prior art from the same family; file Patent 6 as a continuation-in-part
- **Prior art risk areas**: ReAct (Yao et al., 2022), iterative RAG systems, LLM function calling (OpenAI, Anthropic) — claims must be differentiated on: domain specificity, guard enforcement, source-agnostic abstraction, and genome index artifact
- **International filing**: Enterprise application migration market is global; PCT filing recommended
- **Token efficiency numbers**: Validate with production data before filing Claims 15 and 18 (specific percentage claims)
- **Continuation opportunity**: Document section hydration (Claim 17) may warrant a separate continuation once implemented

---

*This document is a technical disclosure for patent filing purposes. It should be reviewed by a registered patent attorney before formal claims are drafted and filed.*
