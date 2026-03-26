# Patent Technical Disclosure: Document-Based Application Genome Extraction

## Title

**System and Method for Automated Application Genome Extraction from Unstructured Product Documentation Using Multi-Agent AI Analysis with Confidence Scoring**

---

## 1. Field of Invention

This invention relates to natural language processing, enterprise application migration, and automated knowledge extraction. Specifically, it describes a system and method for extracting the complete structural genome of enterprise applications from unstructured product documentation (PDF, DOCX, plain text, markdown) using a coordinated multi-agent AI pipeline that parses documents, identifies application structure, and validates extraction quality through a weighted confidence scoring algorithm.

---

## 2. Background and Prior Art Gaps

Enterprise applications are frequently documented in product specification documents, capability assessments, migration readiness reports, and technical design documents. Current approaches to extracting actionable application intelligence from these documents include:

- **Manual reading and interpretation**: Subject matter experts read documentation and manually create data models, workflow diagrams, and integration maps -- a process that takes days to weeks per document and is limited by the reader's domain expertise.
- **Keyword-based extraction**: Simple text mining tools extract keywords but cannot identify structural relationships between entities, workflows, and data models.
- **Named entity recognition (NER)**: NLP tools identify entity names but cannot determine application-specific semantics (e.g., that "HR Case" is a data object with specific fields, not just a noun phrase).
- **Document summarization**: AI summarization tools produce prose summaries but not machine-actionable structural representations.
- **Manual template mapping**: Migration teams create spreadsheet templates and manually map documentation to rows -- error-prone and not scalable.

**Gaps in prior art:**

1. No existing system automatically converts **unstructured product documentation** into a **canonical, machine-actionable application genome** comprising typed objects, fields, workflows, and relationships.
2. No existing system employs a **multi-agent pipeline** with specialized agents for document parsing, structure extraction, and validation to decompose documentation analysis into coordinated subtasks.
3. No existing system produces a **weighted confidence score** based on extraction completeness (presence and richness of objects, fields, workflows, relationships, application metadata) that quantifies how rebuildable the extracted genome is.
4. No existing system supports **multi-format document parsing** (PDF, DOCX, plain text, markdown) with automatic section detection using heading styles, markdown syntax, and typographic patterns.
5. No existing system provides an **iterative refinement loop** where users can supply additional context and re-extract with enriched instructions, progressively improving the genome without starting from scratch.
6. No existing system performs **referential integrity validation** on extracted genomes, verifying that fields reference valid objects and relationships reference valid endpoints.
7. No existing system streams **real-time agent progress** to the client during multi-step extraction, enabling users to observe which pipeline stage is executing and its intermediate results.

---

## 3. Summary of Invention

The present invention provides a multi-agent pipeline that takes product documentation files and extracts their complete structural genome through three specialized AI agents:

1. **Document Parser Agent** -- Parses uploaded documents (PDF via text extraction libraries, DOCX via document object model traversal, plain text/markdown via heading and section detection), producing structured sections with titles, content, and page references. Handles multiple document formats through a pluggable parser architecture with automatic format detection.

2. **Structure Extraction Agent** -- Analyzes the parsed document text using a large language model (LLM) with a specialized system prompt to extract: typed objects (tables, entities, records), fields (with parent object binding, type, and required status), workflows (with triggers and ordered steps), and relationships (with source/target objects, type, and description). Limits input to token-safe boundaries and produces a canonical JSON genome structure.

3. **Synthesis & Validation Agent** -- Validates the extracted genome for referential integrity (fields reference valid objects, relationships reference valid endpoints), computes a weighted confidence score based on extraction completeness, and attaches validation notes. The confidence algorithm uses six weighted components: objects (0.25), fields (0.20), workflows (0.20), relationships (0.15), application name (0.10), summary (0.10), with richness bonuses for depth.

The pipeline supports Server-Sent Events (SSE) streaming for real-time progress, iterative refinement through re-extraction with additional user context, and commits extracted genomes to a version-controlled repository with taxonomized directory structure.

---

## 4. Detailed Description

### 4.1 System Architecture

The system comprises three cooperating AI agents orchestrated by a pipeline coordinator:

1. **Document Parser Agent** -- Format-aware text extraction with section detection
2. **Structure Extraction Agent** -- LLM-based genome extraction from text
3. **Synthesis & Validation Agent** -- Referential integrity checking and confidence scoring

Supporting services:
- **Upload Service** -- Accepts and stores document files with format validation
- **SSE Streaming Service** -- Delivers real-time agent progress to the client
- **GitHub Commit Service** -- Commits extracted genomes to version-controlled repository
- **LLM Configuration Service** -- Resolves tenant-specific LLM provider settings

### 4.2 Data Flow

```
User uploads document (PDF, DOCX, TXT, MD)
       |
[Upload Service]
  * Validate format and size
  * Store to disk with unique identifier
       |
[Document Parser Agent]
  * Detect format from file extension
  * Parse document using format-specific parser
  * Extract sections with titles and content
  * Compute page count and word count
       | parsed text + sections
[Structure Extraction Agent]
  * Build LLM prompt with document text (token-limited)
  * Include vendor, product area, module context
  * LLM extracts: objects, fields, workflows, relationships
  * Parse JSON response, ensure required fields
       | raw genome
[Synthesis & Validation Agent]
  * Validate field-to-object references
  * Validate relationship endpoints
  * Compute weighted confidence score
  * Attach validation notes
       | validated genome + confidence
[GitHub Commit Service]
  * Build file tree: genome.yaml, summary.md, structure/*.json
  * Commit to repository with taxonomy path
       |
Version-controlled repository
```

### 4.3 Multi-Format Document Parsing

The Document Parser Agent supports four document formats through a pluggable parser architecture:

**PDF Parser:**
- Uses text extraction libraries to extract per-page text content
- Each page becomes a section with page number reference
- Handles multi-column layouts and embedded tables

**DOCX Parser:**
- Traverses the document object model (paragraphs, styles)
- Detects headings by style name (Heading 1, Heading 2, etc.) as section boundaries
- Groups body paragraphs under their preceding heading
- Estimates page count from character count

**Plain Text / Markdown Parser:**
- Detects markdown headings (lines starting with #) as section boundaries
- Detects ALL-CAPS lines (3-100 characters) as section boundaries
- Groups content under detected headings
- Estimates page count from character count

**Format Detection:**
- File extension determines parser selection (.pdf, .docx, .txt, .md)
- Unknown extensions fall back to plain text parser
- Each parser produces identical output structure: full_text, sections[], page_count, word_count

### 4.4 Structure Extraction via LLM

The Structure Extraction Agent uses a specialized system prompt that instructs the LLM to:

1. Analyze the document text as product documentation describing an enterprise application
2. Extract objects with name, label, description, and type
3. Extract fields with name, label, type, parent object reference, required status, and description
4. Extract workflows with name, description, trigger, and ordered steps
5. Extract relationships with source object, target object, type, and description
6. Return a canonical JSON structure with mandatory sections

The agent limits input document text to approximately 80,000 characters to stay within LLM token boundaries while maximizing coverage.

**JSON Response Parsing:**
The agent implements robust JSON extraction that:
- Strips markdown code fences from LLM output
- Attempts direct JSON parsing
- Falls back to brace-matching extraction (finding outermost { } boundaries)
- Ensures all required genome sections exist (defaulting to empty arrays)

### 4.5 Weighted Confidence Scoring Algorithm

The Synthesis & Validation Agent computes a confidence score using a weighted multi-factor formula:

```
Score = sum of:
  0.25  if objects exist (at least 1)
  0.20  if fields exist (at least 1)
  0.20  if workflows exist (at least 1)
  0.15  if relationships exist (at least 1)
  0.10  if application_name is non-empty
  0.10  if summary is non-empty

Richness bonuses:
  +0.05  if objects >= 5 (capped at 1.0)
  +0.05  if fields >= 10 (capped at 1.0)
```

This produces a score from 0.0 (empty extraction) to 1.0 (complete extraction with rich content), enabling automated quality assessment and user guidance on whether additional documentation should be provided.

### 4.6 Referential Integrity Validation

The validation agent performs three integrity checks:

1. **Object name validation**: Every object must have a non-empty name
2. **Field-to-object validation**: Every field's `object` reference must match an existing object name (case-insensitive)
3. **Relationship endpoint validation**: Every relationship's `from_object` and `to_object` must match existing object names

Violations are recorded as validation notes (not errors), allowing the genome to be used while informing the user of inconsistencies.

### 4.7 Iterative Refinement

The system supports re-extraction with enriched context:

1. User reviews the initial extraction and identifies gaps
2. User provides additional context (e.g., "Focus on the approval workflows described in section 4")
3. System appends the refinement instructions to the original user notes
4. The full pipeline re-runs with the enriched prompt, producing an improved genome
5. The original upload is reused (no re-upload needed) since the document ID is preserved

This enables progressive improvement without starting from scratch or consuming additional upload bandwidth.

### 4.8 Real-Time Progress Streaming

The pipeline streams agent progress to the client using Server-Sent Events (SSE):

```
data: {"agent": "document_parser", "status": "running"}
data: {"agent": "document_parser", "status": "done", "pages": 12, "words": 3450, "sections": 8}
data: {"agent": "structure_extraction", "status": "running"}
data: {"agent": "structure_extraction", "status": "done", "objects": 5, "fields": 23, "workflows": 3}
data: {"agent": "synthesis", "status": "done", "confidence": 0.85, "validation_issues": 2}
data: {"status": "completed", "genome": {...}, "page_count": 12, "word_count": 3450}
```

Each agent reports start, completion (with metrics), or error status. The client uses these events to update a real-time progress display showing which agent is active and what it has found.

---

## 5. Key Claims

### Independent Claims

**Claim 1.** A computer-implemented method for automated application genome extraction from product documentation comprising:
(a) receiving one or more unstructured document files describing an enterprise application;
(b) parsing the document files using format-specific parsers to extract structured text sections with titles, content, and positional metadata;
(c) submitting the parsed text to a large language model with a specialized extraction prompt to identify application objects, fields, workflows, and relationships;
(d) validating the extracted genome for referential integrity by verifying that field-to-object and relationship endpoint references resolve to valid entities;
(e) computing a weighted confidence score based on extraction completeness using a multi-factor formula with predetermined component weights;
(f) storing the validated genome with confidence score in a canonical format.

**Claim 2.** A system for extracting application genomes from unstructured documentation comprising:
(a) a document parser agent configured to parse multiple document formats (PDF, DOCX, plain text, markdown) into structured sections using format-specific parsing logic with automatic format detection;
(b) a structure extraction agent configured to analyze parsed text using a large language model to extract typed objects, fields with parent object binding, workflows with ordered steps, and relationships with typed endpoints;
(c) a synthesis and validation agent configured to verify referential integrity and compute a weighted confidence score;
(d) a pipeline orchestrator configured to execute agents sequentially with real-time progress streaming via Server-Sent Events.

**Claim 3.** A method for computing extraction confidence in an application genome comprising:
(a) evaluating the presence of extracted objects, fields, workflows, relationships, application name, and summary;
(b) assigning predetermined weights to each component (objects: 0.25, fields: 0.20, workflows: 0.20, relationships: 0.15, name: 0.10, summary: 0.10);
(c) summing the weights of present components;
(d) applying richness bonuses when component counts exceed predetermined thresholds;
(e) capping the total score at a maximum value of 1.0.

### Dependent Claims

**Claim 4.** The method of Claim 1 wherein the format-specific parsers comprise: a PDF parser using text extraction with per-page sections, a DOCX parser using document object model traversal with heading-based section detection, and a text/markdown parser using heading syntax and typographic pattern detection.

**Claim 5.** The method of Claim 1 further comprising an iterative refinement loop wherein the user provides additional context that is appended to the extraction instructions, and the pipeline re-executes using the same uploaded document with enriched prompts.

**Claim 6.** The method of Claim 1 wherein the large language model input is limited to a predetermined character boundary to stay within token limits while maximizing document coverage.

**Claim 7.** The system of Claim 2 wherein the structure extraction agent implements robust JSON parsing comprising: markdown code fence stripping, direct JSON parsing, and fallback brace-matching extraction.

**Claim 8.** The method of Claim 1 further comprising committing the extracted genome to a version-controlled repository using a hierarchical taxonomy structure comprising vendor, product area, and module path components.

**Claim 9.** The method of Claim 1 wherein the genome comprises separate structure files for objects, fields, workflows, and relationships stored as individual JSON files alongside a canonical genome YAML file.

**Claim 10.** The system of Claim 2 wherein the pipeline orchestrator streams agent progress events to the client in real-time, each event comprising agent name, status (running, done, error), and stage-specific metrics.

**Claim 11.** The method of Claim 1 wherein the referential integrity validation records violations as non-blocking validation notes rather than errors, permitting use of the genome while informing the user of inconsistencies.

**Claim 12.** The method of Claim 3 wherein the richness bonuses comprise: +0.05 when object count exceeds 5, and +0.05 when field count exceeds 10.

**Claim 13.** The method of Claim 1 wherein each extracted field includes: name, label, type, parent object reference, required status, and description.

**Claim 14.** The method of Claim 1 wherein each extracted workflow includes: name, description, trigger condition, and an ordered list of steps.

**Claim 15.** The system of Claim 2 further comprising an upload service that validates document format against a whitelist of supported extensions and enforces maximum file size limits.

**Claim 16.** The method of Claim 1 wherein the DOCX parser identifies section boundaries by detecting paragraph styles matching heading patterns (Heading 1, Heading 2, etc.) in the document object model.

**Claim 17.** The method of Claim 1 wherein the plain text parser identifies section boundaries using two heuristics: lines beginning with hash characters (markdown headings) and lines consisting entirely of uppercase characters within a length range.

**Claim 18.** The system of Claim 2 wherein the large language model configuration is resolved per-tenant, enabling different tenants to use different LLM providers and models.

**Claim 19.** The method of Claim 1 further comprising generating a human-readable summary markdown file alongside the canonical genome, containing the application name and LLM-generated summary text.

**Claim 20.** A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of Claim 1.

---

## 6. Advantages Over Prior Art

1. **Automation**: Converts hours of manual document analysis into minutes of automated extraction
2. **Multi-format support**: Single pipeline handles PDF, DOCX, plain text, and markdown without user intervention
3. **Machine-actionable output**: Produces structured genome (objects, fields, workflows, relationships) from unstructured prose, enabling downstream automation
4. **Quality quantification**: Weighted confidence score provides objective measure of extraction completeness
5. **Referential integrity**: Automated validation catches inconsistencies that manual extraction would miss
6. **Iterative improvement**: Refinement loop enables progressive quality improvement without re-uploading documents
7. **Real-time visibility**: SSE streaming provides transparency into multi-agent processing stages
8. **Vendor agnosticism**: Extracted genomes use a canonical format regardless of the source platform described in the documentation
9. **Scalability**: Automated pipeline enables extraction from large document portfolios that would be infeasible to process manually
10. **Auditability**: Version-controlled storage with taxonomy structure provides complete lineage traceability

---

## 7. Drawings/Figures Description

**Figure 1: System Architecture Overview** -- Block diagram showing the three AI agents (Document Parser, Structure Extraction, Synthesis & Validation) with the pipeline orchestrator, upload service, and GitHub commit service.

**Figure 2: Multi-Agent Pipeline Flow** -- Sequence diagram showing document upload, agent execution order, SSE progress events, and final genome output.

**Figure 3: Multi-Format Parser Architecture** -- Decision tree showing format detection from file extension and dispatch to format-specific parsers, all producing identical section output structure.

**Figure 4: Structure Extraction LLM Prompt** -- Annotated example showing the system prompt, user prompt with document content, and expected JSON response structure.

**Figure 5: Confidence Scoring Formula** -- Weighted component diagram showing the six factors, their weights, and the richness bonus thresholds.

**Figure 6: Referential Integrity Validation** -- Flow diagram showing field-to-object validation and relationship endpoint validation with example pass/fail cases.

**Figure 7: Iterative Refinement Loop** -- State diagram showing initial extraction, user review, refinement input, re-extraction, and convergence to desired quality.

**Figure 8: SSE Progress Event Timeline** -- Timeline diagram showing agent events (running, done, error) with metrics payloads as the pipeline executes.

**Figure 9: Taxonomized Repository Structure** -- Directory tree showing genome.yaml, summary.md, and structure/ directory with per-type JSON files.

**Figure 10: Genome Data Model** -- Entity-relationship diagram showing the canonical genome structure with objects owning fields, workflows with steps, and typed relationships.

---

## 8. Inventors

[To be completed by filing attorney]

## 9. Filing Notes

- The weighted confidence scoring algorithm is a key differentiator and should be emphasized in prosecution
- The multi-format document parsing with automatic section detection is independently novel
- Consider filing as a continuation of Patent 1 (API-based Genome Extraction) to establish a patent family covering multiple extraction modalities
- The iterative refinement loop (re-extraction with enriched context) may warrant independent claims
- Prior art search should focus on: document-to-schema extraction, NLP-based data modeling, automated migration tools
- The combination of document parsing + LLM extraction + validation with confidence scoring appears novel in the enterprise migration space

---

*This document is a technical disclosure for patent filing purposes. It should be reviewed by a registered patent attorney before formal claims are drafted and filed.*
