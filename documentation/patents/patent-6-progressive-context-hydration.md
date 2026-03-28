# Patent Technical Disclosure: Progressive Context Hydration

## Title

**System and Method for LLM-Directed Iterative Context Hydration with Programmatic Enforcement of Minimum Context Acquisition Enabling Retrieval-Driven Application Reconstruction with Sublinear Token Scaling**

---

## 1. Field of Invention

This invention relates to artificial intelligence systems, dynamic context management, retrieval-driven generation, computational resource optimization, and enterprise application reconstruction. Specifically, it describes a system and method wherein a large language model (LLM) actively directs its own context acquisition through a structured iterative retrieval protocol with programmatic enforcement of minimum context acquisition -- rather than receiving static pre-loaded context or passively accepting retrieval system selections -- enabling efficient, high-fidelity generation from structured repositories and source documents with token consumption that scales sublinearly relative to source application size.

---

## 2. Background and Prior Art Gaps

### 2.1 The Context Problem in LLM-Mediated Generation

Complex generation tasks -- including but not limited to enterprise application reconstruction, cross-platform migration, document synthesis, and code generation -- require the LLM to understand a substantial body of source material before producing output. The source material may comprise hundreds to thousands of interrelated artifacts: data models, workflows, business rules, UI definitions, integration configurations, API specifications, and documentation.

The fundamental challenge is: **how does the LLM acquire sufficient context to produce high-fidelity output without exceeding computational resource limits or degrading generation quality?**

Prior approaches to providing this context fall into three categories, each with fundamental limitations that the present invention overcomes:

### 2.2 Comparison with Static Prompting

In static prompting, the entire source material is concatenated into a single LLM prompt prior to generation.

**Limitations:**
- **Context window overflow**: Large applications exceed model context limits (e.g., 128K-200K tokens), causing hard failure or silent truncation
- **Attention degradation**: Even within context limits, LLM attention quality degrades on long contexts -- elements early in the prompt receive diminished attention by the time the model processes the end, producing output that favors later context elements over earlier ones
- **Wasteful token consumption**: The entire source is tokenized regardless of relevance to the specific generation task. For a 200KB source where only 20KB is relevant, 90% of tokens are wasted
- **No adaptive retrieval**: The context is fixed before generation begins. The model cannot discover that it needs additional information partway through processing
- **Linear cost scaling**: Token consumption scales linearly with source size. A 10x larger application consumes 10x more tokens

**How the present invention differs**: The present invention provides LLM-directed retrieval with enforced minimum context acquisition. The LLM examines a lightweight index of the source material, decides which specific artifacts it needs, retrieves them incrementally across multiple rounds, and is programmatically prevented from generating output before acquiring sufficient context. Token consumption is bounded by a configurable context budget and scales sublinearly with source size.

### 2.3 Comparison with Retrieval-Augmented Generation (RAG)

In RAG, a retrieval system selects documents based on semantic similarity to the user's query and provides them to the LLM as context.

**Limitations:**
- **System-directed, not LLM-directed**: The retrieval system (embedding model + vector store) decides what to retrieve; the LLM passively receives the result. The LLM cannot correct retrieval errors or request additional context
- **Single-pass retrieval**: One query produces one retrieval set. The system cannot adapt its retrieval strategy based on what the LLM discovers in the retrieved documents
- **Semantic similarity mismatch**: RAG retrieves by semantic similarity to the query, but structured reconstruction tasks require **dependency-aware** retrieval. When building an application from a genome, the LLM needs "the approval workflow" not because it's semantically similar to the user's query, but because the catalog form references it. Semantic similarity does not capture structural dependencies
- **No minimum-retrieval enforcement**: Nothing prevents the LLM from generating output with zero or insufficient retrieved context. The system has no contract that generation must be preceded by adequate retrieval
- **No iterative refinement**: The LLM cannot say "I've read the workflow, and now I realize I also need the approval table." RAG retrieves once; the present invention retrieves iteratively until the LLM is satisfied or a budget is reached
- **No retrieval planning**: The LLM has no mechanism to articulate or reason about its retrieval strategy before executing it

**How the present invention differs**: The present invention inverts the RAG control flow. Instead of a retrieval system selecting context for the LLM, the LLM directs the retrieval system. The LLM examines an index, formulates a retrieval plan, requests specific artifacts, examines them, discovers dependencies, requests additional artifacts, and iterates until it determines it has sufficient context. A programmatic guard layer enforces that the LLM must retrieve at least some source material before generating output, preventing hallucinated generation. The LLM's retrieval plan is explicitly articulated in each round, providing both reasoning audit trails and adaptive strategy refinement.

### 2.4 Comparison with Agentic Tool Calling (ReAct, Function Calling)

In agentic tool calling frameworks (ReAct, OpenAI function calling, Anthropic tool use), LLMs invoke tools through a general-purpose action-observation loop.

**Limitations:**
- **No structured retrieval protocol**: Tool calling provides a general mechanism for the LLM to invoke functions, but does not define a retrieval-specific protocol with typed request/response shapes, retrieval plans, readiness signals, and context budgets
- **No minimum-retrieval enforcement**: Tool calling frameworks do not enforce that the LLM must retrieve context before generating output. The LLM can freely choose to generate without invoking any tools
- **No domain-specific index**: Tool calling provides generic file system access or API access. It does not provide a lightweight, pre-computed entity manifest that maps application components to file paths with summaries, enabling the LLM to plan retrieval efficiently
- **No context budget management**: Tool calling frameworks do not track accumulated context size or enforce budget limits. The LLM may retrieve unbounded amounts of data, exceeding context limits
- **No source-agnostic abstraction**: Each source type (file repository, XML document, parsed PDF) requires a separate tool implementation. The present invention abstracts the retrieval interface across multiple source types while sharing all control logic, guard validation, and context accumulation
- **No retrieval-to-synthesis handoff**: Tool calling frameworks do not package accumulated retrieval context into a structured handoff object (HydrationContext) that can be consumed by a downstream synthesis step while preserving the LLM's working memory
- **No deduplication**: Tool calling frameworks do not prevent the LLM from fetching the same file multiple times across rounds

**How the present invention differs**: The present invention provides a domain-optimized retrieval protocol layered above general LLM capabilities. While tool calling provides the mechanism (the LLM can invoke functions), the present invention provides the structure: a typed retrieval protocol with plan/request/ready signals, a pre-computed entity index for retrieval planning, a programmatic guard that enforces minimum context acquisition, a context budget that bounds accumulation, a deduplication layer that prevents redundant retrieval, and a structured handoff (HydrationContext) that enables retrieval-to-synthesis composition. These structural elements are absent from general tool calling frameworks and constitute the core innovation.

### 2.5 Summary of Differentiation

| Capability | Static Prompting | RAG | Agentic Tool Calling | Present Invention (PCH) |
|---|---|---|---|---|
| Who directs retrieval | N/A (no retrieval) | Retrieval system | LLM (unrestricted) | **LLM (with guard enforcement)** |
| Retrieval rounds | 0 | 1 | Unbounded | **Multi-round with budget** |
| Minimum-context enforcement | None | None | None | **Programmatic guard layer** |
| Retrieval planning | None | None | Implicit | **Explicit plan field per round** |
| Domain-specific index | None | Embedding index | None | **Entity manifest with paths** |
| Context budget | None | Top-K limit | None | **Configurable char/token budget** |
| Source abstraction | N/A | Vector store | Per-tool | **Shared protocol, source-specific fetch** |
| Token scaling | Linear | Sub-linear (fixed K) | Unbounded | **Sublinear with budget enforcement** |
| Deduplication | N/A | N/A | None | **Path-based deduplication** |
| Synthesis handoff | N/A | Injected context | None | **HydrationContext object** |

### 2.6 Gaps in Prior Art

1. No existing system allows an LLM to **actively direct its own context acquisition** through a structured multi-turn protocol with explicit retrieval planning, readiness signaling, and minimum-context enforcement.

2. No existing system produces a **lightweight entity index** (entity manifest with file paths and summaries, no content) as a first-class artifact that initializes the retrieval loop, enabling the LLM to plan retrieval efficiently without loading source content.

3. No existing system implements a **source-agnostic retrieval abstraction** that applies the same LLM-directed loop protocol to multiple source types: version-controlled file repositories, structured XML documents, and parsed document sections.

4. No existing system enforces a **minimum-retrieval contract** (guard validation) that programmatically rejects premature generation before sufficient context has been acquired, with automatic retry and correction injection.

5. No existing system provides a **programmatic enforcement layer preventing premature generation** that is mechanically enforced (not merely instructed), stateful (tracking files fetched per round), and self-correcting (injecting specific correction messages and retrying).

6. No existing system applies **iterative context hydration to the extraction phase itself** -- allowing the LLM to selectively load record types from large source documents rather than receiving the entire document at once.

7. No existing system combines: entity index generation, LLM-directed retrieval, guard enforcement, progressive context accumulation, context budget management, and downstream synthesis handoff as a unified, composable pipeline component.

8. No existing system achieves **sublinear token scaling** relative to source application size through the combination of index-based retrieval planning, selective content loading, and context budget enforcement.

---

## 3. Summary of Invention

The present invention provides a system and method called **Progressive Context Hydration** (PCH) -- an LLM-directed retrieval protocol with programmatic enforcement of minimum context acquisition that achieves sublinear token scaling for generation tasks over large structured sources.

The system comprises:

1. **Entity Index Generation**: At source commit time, a deterministic entity index is generated alongside source files. The index maps all application entities (forms, workflows, tables, UI components, integrations) to their repository file paths with short summaries -- providing a lightweight manifest of the entire application structure without file content. The index typically represents 1-5% of the full source size in tokens, enabling the LLM to comprehend the entire application structure before committing to retrieve any content.

2. **Hydration Loop Initialization**: When an LLM-mediated operation is requested (transformation, translation, extraction), the system initializes the loop by:
   - Listing available source files (file tree or record type index)
   - Fetching and embedding the entity index as the first message
   - Presenting a structured retrieval protocol to the LLM
   - Establishing the context budget for the session

3. **LLM-Directed Retrieval with Enforced Minimum Context Acquisition**: The LLM responds with a structured JSON request identifying which specific files or record types it needs, along with its explicit retrieval plan. The protocol enforces two response shapes:
   - **Retrieval request**: `{"plan": [...], "required_files": ["path/to/file"]}`
   - **Ready signal**: `{"plan": [...], "ready": true, "reason": "..."}`

   The LLM iterates through multiple retrieval rounds, each time examining what it has already loaded, reasoning about what additional context it needs, and requesting specific artifacts. This is fundamentally different from RAG (where the retrieval system selects context) and from tool calling (where the LLM can freely skip retrieval).

4. **Programmatic Enforcement Layer (Guard Validation)**: A stateful guard layer programmatically prevents premature generation. If the LLM attempts to produce output before fetching any source material, the response is mechanically rejected -- not merely discouraged through prompt instructions -- and a correction message is injected into the conversation, forcing a retry. This enforcement layer prevents "hallucinated generation" -- plausible-looking but contextually unfounded output -- regardless of the LLM's inclination, prompt injection attempts, or configuration errors.

5. **Incremental Context Accumulation with Budget Enforcement**: Retrieved file contents are appended to the conversation context. The LLM sees accumulated context growing across rounds, enabling it to discover dependencies iteratively (e.g., "now that I see the workflow, I also need the approval table definition"). A configurable context budget caps total accumulated context, forcing the LLM to produce output with available context when the budget is reached.

6. **Ready-to-Build Transition**: When the LLM signals readiness (or maximum rounds are reached, or context budget is exhausted), the accumulated context is packaged into a `HydrationContext` object containing: loaded files, conversation history, accumulated retrieval plan, and token usage statistics.

7. **Downstream Synthesis Handoff**: The `HydrationContext` is passed to a synthesis step that generates the final output (filesystem plan, genome YAML, application spec) using only the retrieved context -- never the full source. The conversation history is preserved, enabling the synthesis step to continue the same LLM conversation with the accumulated working memory intact.

8. **Source-Agnostic Retrieval Abstraction**: The same loop logic is applied to multiple source types through a shared base abstraction:
   - **File repository retrieval** (for transformation/translation)
   - **Structured record retrieval** (for configuration export extraction)
   - **Document section retrieval** (for documentation extraction)
   Each source type implements source-specific index building and content fetching while sharing all control logic, guard validation, context accumulation, budget enforcement, and deduplication.

---

## 4. Detailed Description

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 PROGRESSIVE CONTEXT HYDRATION                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 1: INDEX INITIALIZATION                             │   │
│  │  • Fetch entity index (entity manifest, no content)       │   │
│  │  • List available source files / record types             │   │
│  │  • Establish context budget for session                   │   │
│  │  • Construct initial prompt with index + user request     │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 2: LLM CALL (Round N)                               │   │
│  │  • Send: conversation history + accumulated context       │   │
│  │  • Receive: JSON response (retrieval request OR ready)    │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 3: GUARD VALIDATION (Enforcement Layer)             │   │
│  │  • REJECT if: generation output + 0 files fetched         │   │
│  │  • REJECT if: ready signal + 0 files fetched              │   │
│  │  • REJECT if: empty request + 0 files fetched             │   │
│  │  • Inject correction message + retry (max N retries)      │   │
│  │  • ACCEPT if: valid retrieval request or guarded ready    │   │
│  │  • Mechanically enforced — cannot be bypassed by LLM      │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 4a: RETRIEVAL (if required_files present)           │   │
│  │  • Fetch each requested file/record via source adapter    │   │
│  │  • Deduplicate (skip already-loaded paths)                │   │
│  │  • Append content to conversation context                 │   │
│  │  • Update context budget tracking                         │   │
│  │  • Force ready if budget exceeded                         │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│                   [repeat until ready, max rounds, or budget]    │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 4b: READY TRANSITION                                │   │
│  │  • Package HydrationContext                               │   │
│  │  • Include: loaded_files, messages, plan, token usage     │   │
│  │  • Preserve conversation history for synthesis handoff    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 SOURCE-AGNOSTIC RETRIEVAL LAYER                  │
│                                                                  │
│  FileRepoHydration          RecordSetHydration   DocHydration    │
│  • list_tree()              • records_by_type    • doc_sections  │
│  • get_file()               • auto-include HPT   • page index   │
│  • path normalization       • type filtering      • section fetch│
│  [Shared: guard, budget, dedup, context accumulation, handoff]   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Entity Index Generation

At source commit time, the system generates a deterministic entity index alongside all source files. This index is the critical initialization artifact for the hydration loop.

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
    "entity_counts": {"forms": 4, "workflows": 8, "tables": 12, "ui_components": 3}
  }
}
```

**Key properties:**
- **No file content**: Only entity names, IDs, file paths, and 1-2 sentence summaries
- **Deterministic**: Generated by rule-based extraction from source structure, no LLM required, same input produces identical output
- **Relationship graph**: Explicit entity-to-entity dependencies enable the LLM to plan multi-step retrieval ("the form depends on the workflow and the table")
- **File path mapping**: Each entity maps to the exact path where its full definition resides

**Design rationale**: The index answers the question "what exists and where is it?" in ~2-5KB, compared to the 50-200KB of the full source. This is the key efficiency driver -- the LLM understands the application structure before committing to retrieving any content. The index enables the LLM to make intelligent retrieval decisions (requesting only the artifacts relevant to the current task) rather than requiring the system to load everything or guess what might be relevant.

### 4.3 LLM-Directed Retrieval Protocol

The system presents a two-shape JSON protocol to the LLM:

**Shape 1 -- Retrieval Request:**
```json
{
  "plan": [
    "Load rental_request form to understand field structure",
    "Load associated approval workflow to map trigger conditions"
  ],
  "required_files": ["structure/catalog.json", "structure/workflows.json"]
}
```

**Shape 2 -- Ready Signal:**
```json
{
  "plan": ["Form structure, workflow, and data model fully loaded"],
  "ready": true,
  "reason": "All entities needed for the target app spec are loaded"
}
```

The `plan` field is required in both shapes. It serves three purposes:
1. **Retrieval reasoning**: Forces the LLM to reason explicitly about its retrieval strategy before requesting files, improving retrieval quality
2. **Multi-round planning**: Enables the LLM to articulate a multi-step retrieval plan across rounds ("first I need the primary entities, then I'll check dependencies")
3. **Audit trail**: Provides a human-readable record of the LLM's decision process, surfaced in the UI as progress updates

**Round progression:**
- **Round 0 (initialization)**: Index fetched, first prompt constructed -- no LLM call
- **Round 1**: LLM analyzes index, formulates retrieval plan, requests primary files (forms, workflows)
- **Round 2**: LLM reads primary files, discovers dependencies, updates plan, requests secondary files (tables, configs)
- **Rounds 3+**: LLM requests additional context as dependencies are discovered, or signals ready
- **Budget enforcement**: If context budget is reached, system injects a directive requiring output with available context
- **Force-ready**: On final round, system injects a directive requiring ready signal

**The critical difference from RAG and tool calling**: In each round, the LLM's retrieval request is informed by:
1. The entity index (what exists)
2. All previously retrieved content (what it already knows)
3. The dependencies it has discovered in prior rounds (what it now realizes it needs)
4. The explicit retrieval plan it articulated in prior rounds (its evolving strategy)

This enables **adaptive, dependency-driven retrieval** that cannot be achieved by similarity-based retrieval (RAG) or unstructured tool calling.

### 4.4 Programmatic Enforcement Layer (Guard Validation)

The guard validation layer is a programmatic enforcement mechanism that prevents premature generation -- the most critical differentiator between the present invention and all prior art (static prompting, RAG, tool calling).

A stateful `Guard` object is instantiated per hydration loop run. It maintains retry counts per round, tracks cumulative files fetched, and enforces the minimum-retrieval contract.

#### 4.4.1 Why Programmatic Enforcement Is Necessary

LLMs are probabilistic systems. Even with explicit instructions to "retrieve context before generating output," LLMs may:
- Generate plausible-looking output without retrieving any source material (hallucinated generation)
- Prematurely signal readiness after retrieving insufficient context
- Respond with empty retrieval requests that advance the round counter without acquiring context
- Be manipulated by prompt injection to skip retrieval

Prompt instructions alone cannot guarantee retrieval-first behavior. The guard provides **mechanical enforcement** -- the LLM's output is intercepted and validated before the system acts on it, regardless of the LLM's intent.

#### 4.4.2 Rejection Conditions

| Condition | Detection | Correction Injected |
|---|---|---|
| Premature generation | `output`/`filesystem_plan` key present AND `files_fetched == 0` | "You must retrieve source files before generating output. Examine the index and request the files you need." |
| Premature ready | `ready: true` AND `files_fetched == 0` | "You cannot signal readiness without first retrieving source files. The minimum-retrieval contract requires at least one retrieval round." |
| Empty request | `required_files: []` AND `files_fetched == 0` | "Your retrieval request is empty and no files have been fetched. Please examine the index and request specific files, or provide a ready signal with a reason." |

#### 4.4.3 Retry Logic

- Maximum retries per round is configurable (default: 2)
- After maximum retries, the guard accepts the response to prevent infinite loops
- Each rejection injects a specific correction message explaining the violation and providing guidance
- The correction message becomes part of the conversation history, ensuring the LLM incorporates the feedback in subsequent attempts

#### 4.4.4 Guard as Enforcement Layer

The guard is not advisory -- it is a **programmatic enforcement layer preventing premature generation**:

- **Mechanically enforced**: The guard intercepts every LLM response before the system acts on it. A response that violates the minimum-retrieval contract is never passed to the retrieval or synthesis stages.
- **Stateful**: The guard tracks cumulative files fetched across all rounds. Once the minimum retrieval threshold is met, the guard allows ready signals and generation output.
- **Self-correcting**: Each rejection injects a correction message that becomes part of the ongoing conversation, guiding the LLM toward correct behavior.
- **Tamper-resistant**: Because the guard operates at the system level (outside the LLM's conversation), it cannot be bypassed by prompt injection, instruction overriding, or LLM misconfiguration.
- **Composable**: The guard is a standalone component that can be applied to any LLM-directed retrieval loop, independent of the specific source type, index format, or downstream synthesis step.

### 4.5 Context Budget Enforcement

The system enforces a configurable context budget that caps total accumulated context across all retrieval rounds:

**Budget parameters:**
- `MAX_FILE_CHARS`: Maximum characters loaded per individual file/record
- `MAX_TOTAL_CHARS`: Maximum total characters accumulated across all rounds
- `MAX_ROUNDS`: Maximum number of retrieval rounds before forced ready

**Enforcement mechanism:**
1. After each retrieval round, the system computes total accumulated context size
2. If `total_chars > MAX_TOTAL_CHARS`, the system injects a budget-exceeded directive: "Context budget reached. You must now produce output using the context you have accumulated."
3. The system forces a ready transition, preventing further retrieval
4. Individual files exceeding `MAX_FILE_CHARS` are truncated at the file level with a truncation marker

**Significance for sublinear scaling**: The context budget is what enables sublinear token scaling. Regardless of source application size (100 files or 10,000 files), the total context loaded is bounded by `MAX_TOTAL_CHARS`. Combined with the entity index (which gives the LLM a complete structural overview without loading content), the LLM can make intelligent retrieval decisions within the budget, loading only the most relevant artifacts for the specific task.

### 4.6 Source-Agnostic Loop Abstraction

The hydration loop is abstracted over multiple source types through a shared base:

**4.6.1 File Repository Hydration (Transformation/Translation)**

```
Source:  Version-controlled file repository
Index:   entity index (entity manifest) + directory tree
Request: required_files: ["structure/entities.json"]
Fetch:   get_file(tenant, base_path + "/" + path)
Budget:  MAX_FILE_CHARS per file, MAX_TOTAL_CHARS total
```

Used when applying translation recipes or user transformations to committed genomes.

**4.6.2 Structured Record Hydration (Configuration Export Extraction)**

```
Source:  Parsed structured record sets (XML, JSON)
Index:   Record type summary {type: {count, sample_names[]}}
Request: required_files: ["catalog_item", "workflow"]
Fetch:   filter records_by_type[type_name][:MAX_CHARS_PER_TYPE]
Budget:  MAX_CHARS_PER_TYPE per type, MAX_TOTAL total

Auto-include: High-priority types loaded first within half budget
```

Used during configuration export extraction. Replaces the prior approach of sending all records in a single prompt. The loop is bypassed for small record sets below a configurable threshold via direct auto-include without LLM overhead.

**4.6.3 Document Section Hydration (Documentation Extraction)**

```
Source:  Parsed document sections (PDF, DOCX, TXT)
Index:   Table of contents + section titles + word counts
Request: required_files: ["section_3", "appendix_b"]
Fetch:   return pre-parsed section text
Budget:  MAX_SECTION_CHARS per section, MAX_TOTAL total
```

Used when extracting genomes from large documentation files. Replaces full-document prompting.

**Shared components across all source types:**
- Guard validation (identical enforcement logic)
- Context budget enforcement
- HydrationContext data structure
- Conversation history management
- Token usage tracking
- Round limit enforcement
- Path-based deduplication

### 4.7 HydrationContext Data Structure

The output of every hydration loop run is a `HydrationContext` object:

```
HydrationContext:
  source_path:          source identifier
  user_request:         original user intent

  loaded_files:         path → content map (deduplicated)
  iterations:           per-round retrieval records
  accumulated_plan:     LLM's stated reasoning across rounds

  total_chars:          total context accumulated
  total_input_tokens:   LLM input tokens consumed during hydration
  total_output_tokens:  LLM output tokens consumed during hydration
  total_latency_ms:     total time spent in hydration

  ready:                true = LLM signalled sufficient context
  ready_reason:         LLM's stated reason for readiness

  index:                parsed entity index (if present)
  file_tree:            available files/records
  messages:             full conversation history for handoff
  system_prompt:        for downstream synthesis use
```

The `messages` field enables a critical capability: the downstream synthesis step can **continue the same conversation**, receiving the accumulated context as if it were a single coherent session. This preserves the LLM's working memory across the retrieval and synthesis phases -- the LLM does not need to re-process already-loaded context or re-derive conclusions it reached during the retrieval phase.

### 4.8 Sublinear Context Scaling

The present invention achieves **sublinear token scaling** relative to source application size -- a fundamental efficiency advantage over static prompting (linear scaling), and a bounded-cost advantage over RAG (fixed top-K, potentially insufficient) and tool calling (unbounded retrieval).

#### 4.8.1 Token Scaling Model

**Static prompting (linear scaling):**

| Application size | Source chars | Tokens consumed | Context window | Outcome |
|---|---|---|---|---|
| Small (20 artifacts) | ~10K chars | ~2,500 tokens | Fits | Acceptable |
| Medium (200 artifacts) | ~100K chars | ~25,000 tokens | Fits | Degraded attention |
| Large (2,000 artifacts) | ~1M chars | ~250,000 tokens | Overflow | Fails / truncated |
| Very large (10,000 artifacts) | ~5M chars | ~1,250,000 tokens | Overflow | Impossible |

Token consumption: **O(N)** where N = source size

**Progressive Context Hydration (sublinear scaling):**

| Application size | Index size | Hydration tokens | Synthesis tokens | Total | vs. static |
|---|---|---|---|---|---|
| Small (< 50 artifacts) | ~1KB | 0 (auto-include) | ~2,500 | ~2,500 | Same |
| Medium (200 artifacts) | ~3KB | ~3,000 | ~6,000 | ~9,000 | **64% reduction** |
| Large (2,000 artifacts) | ~8KB | ~5,000 | ~8,000 | ~13,000 | **95% reduction** |
| Very large (10,000 artifacts) | ~15KB | ~7,000 | ~10,000 | ~17,000 | **99% reduction** |
| Any size | Bounded | Bounded | Bounded | Bounded | **No overflow** |

Token consumption: **O(log N)** approaching a constant bound set by MAX_TOTAL_CHARS

#### 4.8.2 Why Sublinear Scaling Is Achievable

Sublinear scaling is achievable because of three properties:

1. **Index compression**: The entity index represents the entire application structure in 1-5% of the source token count. The LLM can comprehend a 10,000-artifact application from a 15KB index (~3,750 tokens) rather than a 5MB source (~1,250,000 tokens).

2. **Selective retrieval**: For any specific generation task, the LLM typically needs only 5-15% of the source artifacts. The entity index enables the LLM to identify and retrieve exactly the relevant artifacts without loading the rest.

3. **Context budget enforcement**: The budget caps total accumulated context regardless of source size. A 10x larger application does not produce a 10x larger context -- the LLM simply makes more selective retrieval choices within the same budget.

#### 4.8.3 Scaling Implications

The sublinear scaling property has several important implications:

- **No application is too large**: Applications with 10,000+ artifacts can be processed with bounded token consumption, where static prompting would fail entirely
- **Predictable cost**: Token consumption is bounded by the context budget, enabling accurate cost prediction regardless of application size
- **Constant-quality output**: Because the LLM selectively retrieves the most relevant artifacts (rather than receiving diluted attention across a massive context), output quality is maintained or improved as application size grows
- **Energy efficiency**: Sublinear token scaling translates directly to sublinear energy consumption, reducing the environmental impact of processing large applications

### 4.9 Integration with Translation Recipes (Patent 3 Enhancement)

Progressive Context Hydration composes with the Translation Recipe system (Patent 3):

**Prior approach (Patent 3):**
- Recipe loaded → full repository context loaded (file tree + limited files) → single LLM call

**Enhanced approach:**
- Recipe loaded → hydration loop initializes with recipe instructions injected into system prompt → LLM retrieves exactly the files relevant to the recipe's output requirements → synthesis step produces output

The recipe instructions are injected into the system prompt of the hydration loop, causing the LLM to make recipe-informed retrieval decisions:

```
extra_system = translation.instructions  # injected into hydration system prompt
```

This produces higher-quality recipe output because the LLM retrieves the exact source sections the recipe needs, rather than receiving an arbitrary fixed set of files.

**Updated token efficiency (with hydration):**

| Step | Tokens (Patent 3 alone) | Tokens (with PCH) | Reduction |
|---|---|---|---|
| Recipe application (per genome) | ~12,000 | ~8,000 | 33% |
| Portfolio of 100 genomes | ~1,659,000 | ~1,107,000 | 33% additional |

Combined with Patent 3's recipe amortization, the system achieves an **83-87% total token reduction** compared to unguided interactive transformation.

---

## 5. Key Claims

### Independent Claims

**Claim 1.** A computer-implemented method for LLM-directed iterative context hydration comprising:
(a) generating a lightweight entity index at source commit time, the index mapping application entities to their file paths with summaries but without file content;
(b) initializing a hydration loop by presenting an LLM with the entity index and a structured retrieval protocol defining two response shapes: a retrieval request shape comprising a retrieval plan and a list of requested files, and a ready signal shape comprising a readiness declaration with reason;
(c) receiving from the LLM a structured retrieval request identifying specific files and an explicit retrieval plan articulating the LLM's retrieval strategy;
(d) validating the LLM response via a programmatic guard layer that rejects generation output or readiness signals if no source files have been fetched, injecting a correction message into the LLM conversation and retrying;
(e) fetching the requested files from a source system and appending their contents to the LLM conversation context, with deduplication to prevent redundant retrieval of already-loaded files;
(f) repeating steps (c)-(e) across multiple retrieval rounds until the LLM signals readiness, a maximum round limit is reached, or a context budget is exhausted;
(g) packaging accumulated context into a HydrationContext object comprising loaded files, full conversation history, accumulated retrieval plan, and token usage statistics;
(h) passing the HydrationContext to a downstream synthesis step that continues the same LLM conversation with the accumulated working memory intact.

**Claim 2.** A system for LLM-directed retrieval with enforced minimum context acquisition comprising:
(a) an index generator configured to produce a deterministic entity index mapping application entities to file paths with summaries at commit time;
(b) a hydration loop controller configured to manage multi-turn LLM dialogue for iterative file retrieval with explicit retrieval planning per round;
(c) a programmatic guard layer configured to intercept every LLM response and mechanically reject responses that violate the minimum-retrieval contract, injecting correction messages and retrying, wherein the guard operates at the system level outside the LLM conversation and cannot be bypassed by prompt injection, instruction overriding, or LLM misconfiguration;
(d) a context budget enforcer configured to track accumulated context size and force ready transitions when the budget is exceeded;
(e) a source-agnostic retrieval abstraction configured to apply the same loop protocol to file repositories, structured record sets, and document sections through source-specific adapters sharing common control logic;
(f) a HydrationContext accumulator configured to package loaded context, conversation history, and token usage for downstream synthesis.

**Claim 3.** A method for source-agnostic iterative context retrieval comprising:
(a) abstracting a retrieval loop over multiple source types including: version-controlled file repositories, structured record collections, and parsed document sections;
(b) for each source type, implementing a source-specific index builder and content fetcher while sharing loop control logic, guard validation, context budget enforcement, deduplication, and context accumulation;
(c) thereby enabling the same LLM-directed retrieval protocol to apply to transformation, translation, and extraction operations without modification to the loop controller.

**Claim 4.** A method for programmatic enforcement of minimum context acquisition in LLM-mediated generation comprising:
(a) maintaining a stateful guard object tracking files fetched per retrieval round and cumulatively across all rounds;
(b) intercepting every LLM response before the system acts on it;
(c) detecting premature generation defined as: generation output present AND cumulative files fetched equals zero;
(d) detecting premature readiness defined as: ready signal present AND cumulative files fetched equals zero;
(e) rejecting detected premature responses by injecting type-specific correction messages into the LLM conversation and initiating a retry;
(f) accepting the response after a configurable maximum number of retries per round to ensure loop termination;
(g) wherein the guard operates as a programmatic enforcement layer outside the LLM's conversational context and cannot be bypassed by prompt content, prompt injection, or LLM instruction following.

**Claim 5.** A computer-implemented method for LLM-mediated generation wherein the LLM must retrieve context from a source system before generating output, comprising:
(a) presenting an LLM with a structured index of available source material and a retrieval protocol, wherein the index describes the source material's structure and content without including the source content itself;
(b) requiring the LLM to issue one or more structured retrieval requests identifying specific source artifacts to load, each request accompanied by an explicit retrieval plan;
(c) programmatically enforcing that the LLM retrieves at least a minimum quantity of source material before the system accepts any generation output, wherein enforcement is performed by a guard layer that mechanically intercepts and rejects premature generation attempts;
(d) accumulating retrieved source material across multiple retrieval rounds with deduplication and budget enforcement;
(e) upon the LLM signaling readiness or a termination condition being met, synthesizing output using only the accumulated retrieved context;
(f) wherein the total source material retrieved is a subset of the available source material, selected by the LLM based on relevance to the generation task, and the subset size is bounded by a configurable context budget independent of total source size.

### Dependent Claims

**Claim 6.** The method of Claim 1 wherein the entity index is generated deterministically by rule-based extraction from source structure without LLM inference, ensuring identical inputs produce identical indexes.

**Claim 7.** The method of Claim 1 wherein the LLM retrieval request includes a `plan` field comprising one or more natural language statements of the LLM's retrieval strategy, and wherein the plan is surfaced in the user interface as a real-time progress indicator, and wherein the plan evolves across rounds as the LLM discovers dependencies in retrieved content.

**Claim 8.** The method of Claim 1 wherein fetched file contents are deduplicated by path, preventing redundant retrieval of already-loaded files across rounds, and wherein the LLM is informed of already-loaded paths to prevent redundant requests.

**Claim 9.** The method of Claim 1 wherein the system enforces a context budget expressed as maximum accumulated characters, injecting a budget-exceeded directive into the conversation when the budget is reached, forcing the LLM to produce output with available context regardless of whether the LLM has signaled readiness.

**Claim 10.** The system of Claim 2 wherein the source-agnostic retrieval abstraction for structured record sources implements an auto-include pass that loads high-priority record types within a reserved portion of the context budget before the LLM-directed loop begins.

**Claim 11.** The system of Claim 2 wherein for structured record sources, the loop is bypassed entirely for small record sets below a configurable threshold, applying direct auto-include without LLM overhead.

**Claim 12.** The method of Claim 1 wherein the HydrationContext includes the full multi-turn conversation history, enabling the downstream synthesis step to continue the same LLM conversation without re-initializing context or re-processing previously loaded files.

**Claim 13.** The method of Claim 1 wherein the hydration loop is composed with a translation recipe system such that recipe instructions are injected into the hydration system prompt, causing the LLM to selectively retrieve only the source artifacts relevant to the recipe's required output.

**Claim 14.** The method of Claim 4 wherein the guard maintains per-round retry counts and the maximum retries is configurable, with the guard accepting any response after the maximum is reached to ensure loop termination, and wherein each rejection injects a type-specific correction message that becomes part of the ongoing conversation.

**Claim 15.** The system of Claim 2 wherein the entity index maps application entities into canonical categories each with an entity identifier, display name, and repository file path, and wherein the index includes an explicit relationship graph mapping entity-to-entity dependencies to enable multi-step retrieval planning.

**Claim 16.** The method of Claim 1 wherein token consumption is sublinear relative to source application size: processing an application 10x larger requires no more than 2x additional tokens due to context budget enforcement and selective LLM-directed retrieval.

**Claim 17.** The method of Claim 1 wherein for transformation operations, the hydration loop retrieves files from a version-controlled repository using: (i) repository tree listing as the initial index, (ii) per-file content fetching via authenticated API, and (iii) path normalization to handle relative vs. absolute path formats.

**Claim 18.** The method of Claim 3 wherein document section hydration parses source documents into sections indexed by title, page range, and word count, enabling the LLM to request specific sections without receiving the full document.

**Claim 19.** The system of Claim 2 wherein the guard validator distinguishes between three premature response types: (i) premature generation with filesystem plan or specification output, (ii) premature readiness signal without prior retrieval, and (iii) empty retrieval request without readiness signal, applying a specific correction message to each type.

**Claim 20.** The method of Claim 1 further comprising streaming server-sent events (SSE) to a client interface reporting: retrieval phases, files fetched with sizes, LLM plan updates, context budget utilization, and round completion.

**Claim 21.** A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of Claim 1.

**Claim 22.** The method of Claim 5 wherein the LLM formulates a multi-round retrieval plan during the first retrieval round, wherein the plan identifies primary artifacts to retrieve immediately and secondary artifacts to retrieve after examining the primary artifacts, and wherein the plan is revised in subsequent rounds based on dependencies discovered in retrieved content.

**Claim 23.** The method of Claim 5 wherein the context budget comprises a maximum total character count independent of total source size, and wherein the LLM's retrieval selections within the budget are informed by the structured index such that the LLM retrieves only the artifacts most relevant to the generation task, and wherein the bounded budget combined with index-informed retrieval produces sublinear token scaling relative to source size.

**Claim 24.** The method of Claim 5 wherein the source system is abstracted through a retrieval interface that exposes: (i) an index listing operation returning available source artifacts with metadata and summaries, (ii) a content fetching operation returning the full content of a specific artifact by identifier, and (iii) a deduplication check preventing retrieval of already-loaded artifacts, and wherein the retrieval interface is source-agnostic such that the LLM-directed retrieval protocol operates identically regardless of whether the source is a file repository, structured record set, or document collection.

---

## 6. Advantages Over Prior Art

### vs. Static Prompting
1. **No context window overflow**: Context budget enforcement prevents any application size from exceeding model limits
2. **Proportional attention**: LLM only sees relevant files; attention is not diluted by irrelevant artifacts
3. **Predictable token cost**: Cost is bounded by context budget, not application size
4. **Sublinear scaling**: 10x larger application costs ~1.5x more tokens, not 10x
5. **Adaptive retrieval**: LLM can discover and request dependencies mid-process; static prompting cannot

### vs. Naive RAG
1. **LLM drives retrieval**: The LLM determines what it needs, not a semantic similarity function -- critical for structured tasks where dependencies are logical, not semantic
2. **Multi-turn adaptive retrieval**: Each round can request different files based on what the prior round revealed
3. **Minimum-retrieval enforcement**: Guard prevents generation before retrieval; RAG has no such contract
4. **Structured protocol**: JSON shapes with plan/required_files/ready fields provide a typed interface; RAG uses unstructured similarity scores
5. **Retrieval planning**: LLM explicitly articulates and revises its retrieval strategy; RAG provides no planning mechanism
6. **Dependency-aware**: LLM follows structural dependencies ("the form references this workflow, which references this table"); RAG retrieves by semantic similarity

### vs. General Agentic Tool Calling
1. **Domain-specific index**: Entity index provides application-aware entity mapping, not generic file system access
2. **Guard enforcement**: Programmatic minimum-context contract has no equivalent in general tool-use frameworks
3. **Context budget**: Bounded accumulation prevents unbounded retrieval; tool calling has no budget concept
4. **Source-agnostic abstraction**: Same protocol for file repos, record sets, documents -- tool calling requires custom tool implementations per source
5. **Composable with recipes**: Hydration loop integrates as a pre-step to recipe execution, amplifying token savings of both systems
6. **Structured handoff**: HydrationContext provides a typed interface between retrieval and synthesis; tool calling has no equivalent
7. **Deduplication**: Path-based deduplication prevents redundant retrieval; tool calling does not track what has been fetched

---

## 7. Relationship to Prior OverYonder Patents

### Patent 1 Modifications (Genome Extraction)
The entity index artifact described in Section 4.2 should be added to Patent 1's claims as:
- A new artifact type committed alongside genome.yaml and graph.yaml
- A new dependent claim covering deterministic index generation
- An addition to the repository structure diagrams

The structured record hydration described in Section 4.6.2 should be added to Patent 1 as:
- A new pipeline stage inserted between parsing and genome extraction
- A dependent claim covering threshold-based loop activation

### Patent 3 Modifications (Translation Recipes)
Patent 3 currently states "full repository context" is loaded for recipe application. This should be updated to reference the hydration loop as the context loading mechanism:
- Replace fixed file loading with "initiates hydration loop with recipe instructions injected as system context"
- Add updated token efficiency numbers incorporating hydration savings (Section 4.9)
- Add a new claim covering recipe-hydration composition

### Patent 5 Modifications (Application Genome Modeling)
The entity index format described in Section 4.2 should be referenced in Patent 5 as an additional genome representation format alongside flat and graph schemas.

---

## 8. Drawings/Figures Description

**Figure 1: System Architecture** -- Block diagram showing the hydration loop stages (Index Init → LLM Call → Guard Enforcement → Retrieval → Context Accumulation → Budget Check → Ready Transition) with the downstream synthesis step and source-agnostic retrieval layer.

**Figure 2: Comparison with Prior Art** -- Four-column diagram comparing Static Prompting, RAG, Agentic Tool Calling, and Progressive Context Hydration across dimensions: control flow, retrieval mechanism, enforcement, and token scaling.

**Figure 3: Guard Validation State Machine** -- State diagram showing guard states (waiting, rejected-premature-gen, rejected-premature-ready, rejected-empty, accepted, max-retries) with transitions for each rejection condition and correction message injection.

**Figure 4: Source-Agnostic Abstraction** -- Three-column diagram showing File Repository, Structured Records, and Document sources with shared loop controller, guard, budget enforcement, and source-specific index/fetch implementations.

**Figure 5: Entity Index Structure** -- Entity-relationship diagram of the entity index with entities, relationships, summaries, and metadata sections, annotated with token size comparison to full source.

**Figure 6: Round-by-Round Context Growth** -- Chart showing context accumulated per round for a sample application, with entity index, round-1 retrieval, round-2 dependency discovery, round-3 retrieval, and ready signal annotated.

**Figure 7: Sublinear Token Scaling** -- Graph showing token consumption vs. application size for Static Prompting (linear O(N)), RAG (fixed K), Tool Calling (unbounded), and PCH (sublinear O(log N) with budget ceiling), with the PCH budget ceiling annotated.

**Figure 8: Token Efficiency Comparison** -- Bar chart comparing single-pass, naive RAG, and Progressive Context Hydration token consumption for small/medium/large/very large applications.

**Figure 9: HydrationContext Data Flow** -- Sequence diagram showing how HydrationContext is produced by the loop and consumed by downstream synthesis and recipe execution, with conversation history preservation annotated.

**Figure 10: Guard Enforcement Flow** -- Detailed sequence diagram showing a premature generation attempt being intercepted, rejected, corrected, and retried by the guard layer.

**Figure 11: Record Type Index** -- Sample formatted index showing record types, counts, sample names, auto-included vs. available sections.

**Figure 12: Integration with Translation Recipe System** -- Diagram showing how recipe instructions are injected into the hydration system prompt, how hydration retrieves recipe-relevant files, and how hydration output feeds the synthesis step.

**Figure 13: Context Budget Enforcement** -- Diagram showing budget tracking across rounds, with budget-exceeded directive injection and forced ready transition.

**Figure 14: Multi-Round Retrieval Planning** -- Diagram showing the LLM's retrieval plan evolving across three rounds: initial plan based on index → revised plan after discovering dependencies → final plan with all required context identified.

**Figure 15: Sublinear Scaling Proof** -- Mathematical derivation showing that token consumption is bounded by `index_tokens + MAX_TOTAL_CHARS_TOKENS + synthesis_tokens`, all of which are independent of source size N, producing O(1) scaling with respect to N (sublinear).

---

## 9. Inventors

[To be completed by filing attorney]

## 10. Filing Notes

- **Strongest novel claim**: The programmatic guard enforcement layer (Claims 4 and 5) is the most mechanically novel element -- no prior art enforces minimum-retrieval as a programmatic contract with retry injection that operates outside the LLM's conversational context. This is the primary differentiator from RAG, ReAct, and tool calling.
- **Broadest claim**: Claim 5 covers any LLM system that must retrieve context before generating output, with programmatic enforcement, structured index, and budget-bounded selective retrieval. This is deliberately broad and not limited to enterprise applications or genome-specific use cases.
- **Key differentiation from RAG**: RAG is system-directed retrieval (the retrieval system selects context). PCH is LLM-directed retrieval (the LLM selects context). RAG is single-pass. PCH is multi-round adaptive. RAG has no minimum-retrieval enforcement. PCH has a programmatic guard. These are fundamental architectural differences, not incremental improvements.
- **Key differentiation from ReAct/tool calling**: Tool calling provides a mechanism (the LLM can invoke functions). PCH provides structure: typed protocol, entity index, guard enforcement, budget management, deduplication, and synthesis handoff. Tool calling has no minimum-retrieval contract, no budget, no deduplication, and no structured handoff.
- **Sublinear scaling claim**: The O(log N) token scaling property (Section 4.8) is mathematically demonstrable from the budget enforcement mechanism. Validate with production data across application sizes before filing Claim 16.
- **File as continuation**: Patent 3 (Translation Recipes) and Patent 5 (Application Genome Modeling) should be cited as prior art from the same family; file as a continuation-in-part.
- **Prior art risk areas**: ReAct (Yao et al., 2022), iterative RAG (FLARE, Self-RAG), LLM function calling (OpenAI, Anthropic), agentic frameworks (LangChain, AutoGen) -- claims must be differentiated on: programmatic guard enforcement, structured retrieval protocol with planning, context budget enforcement, source-agnostic abstraction, and sublinear scaling.
- **International filing**: PCT filing recommended for global enterprise market.
- **Continuation opportunity**: Document section hydration (Claim 18) may warrant a separate continuation once fully implemented and production-validated.

---

*This document is a technical disclosure for patent filing purposes. It should be reviewed by a registered patent attorney before formal claims are drafted and filed.*
