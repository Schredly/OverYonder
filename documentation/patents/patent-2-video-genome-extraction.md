# Patent Technical Disclosure: Video Genome Extraction

## Title

**System and Method for Multi-Agent Video Analysis-Based Application Genome Extraction Using Computer Vision, Audio Transcription, and Structural Synthesis**

---

## 1. Field of Invention

This invention relates to computer vision, application reverse engineering, multi-agent AI systems, and enterprise software migration. Specifically, it describes a system and method for extracting the complete structural genome of enterprise applications from video recordings using a coordinated multi-agent pipeline that combines visual frame analysis, audio transcription, UI reverse engineering, and structural synthesis.

---

## 2. Background and Prior Art Gaps

Current approaches to understanding enterprise application structure for migration purposes require:

- **API access**: Direct connection to source platform APIs, which may be restricted by security policies, licensing, or technical constraints
- **Source code access**: Reading configuration files, scripts, or source code, which may not be available for SaaS applications
- **Manual documentation**: Subject matter experts manually documenting application structure — error-prone, time-consuming, and often incomplete
- **Screen recording for documentation only**: Video walkthroughs are recorded but never machine-analyzed; they serve only as reference material for human reviewers

**Gaps in prior art:**

1. No existing system extracts **application structural metadata** (objects, fields, workflows, relationships) from **video recordings** of application walkthroughs.
2. No existing system uses **multi-agent AI architecture** to decompose video analysis into specialized parallel tasks (frame analysis, UI extraction, audio transcription, structural synthesis).
3. No existing system performs **per-screen UI reverse engineering** from video frames, producing HTML/CSS skeletons, color palettes, component hierarchies, and typography analysis.
4. No existing system **correlates audio narration with visual content** by timestamp to enrich structural extraction with spoken context (feature descriptions, business rules, workflow explanations).
5. No existing system produces **design tokens** (colors, typography, spacing patterns) alongside structural data, enabling both functional and visual replication of the source application.
6. No existing system performs **perceptual hash-based frame deduplication** with scene-change detection to optimize vision API costs while maintaining coverage.

---

## 3. Summary of Invention

The present invention provides a multi-agent pipeline that takes video recordings of enterprise applications and extracts their complete structural genome through five specialized AI agents operating in a coordinated directed acyclic graph (DAG):

1. **Frame Intelligence Agent** — Extracts frames from video using adaptive intervals, computes perceptual hashes (8x8 grayscale average-hash), and deduplicates near-identical frames using Hamming distance thresholding, producing a set of unique screens with scene identifiers.

2. **UI Extraction Agent** — Analyzes each unique screen using a vision LLM to extract HTML/CSS skeletons, color palettes (hex codes with usage context), typography patterns, component hierarchies, interactive elements, and data element labels.

3. **Audio/Speech Agent** — Extracts the audio track via ffmpeg, transcribes using the Whisper API with segment-level timestamps, and correlates transcript segments to the nearest video frame by timestamp midpoint matching.

4. **Application Structure Agent** — Synthesizes UI analysis and audio transcript into a complete application genome: typed objects with descriptions and key fields, fields with types and validation rules, workflows with steps and triggers, relationships with cardinality, navigation structure, and role/permission observations.

5. **Synthesis & Validation Agent** — Merges all agent outputs into a final genome document, validates consistency, resolves conflicts, assigns per-section confidence scores, and produces both backward-compatible flat lists and enriched structured representations.

The pipeline executes Agents 2 and 3 in parallel (as they are independent), streams progress to the client via Server-Sent Events (SSE), and stores extraction results with full metadata for later retrieval and GitHub commit.

---

## 4. Detailed Description

### 4.1 Pipeline Architecture (Agent DAG)

```
                    ┌──────────────────────┐
                    │  Video File Input     │
                    └──────────┬───────────┘
                               ↓
                    ┌──────────────────────┐
                    │  Agent 1: Frame      │
            Stage 1 │  Intelligence        │   Sequential
                    │  (scene detection,   │
                    │   deduplication)      │
                    └──────────┬───────────┘
                          ┌────┴────┐
                          ↓         ↓
               ┌─────────────┐ ┌─────────────┐
       Stage 2 │ Agent 2: UI │ │ Agent 3:    │   Parallel
               │ Extraction  │ │ Audio/Speech│   (asyncio.gather)
               └──────┬──────┘ └──────┬──────┘
                      └───────┬───────┘
                              ↓
                    ┌──────────────────────┐
            Stage 3 │  Agent 4: App        │   Sequential
                    │  Structure           │   (depends on 2+3)
                    └──────────┬───────────┘
                               ↓
                    ┌──────────────────────┐
            Stage 4 │  Agent 5: Synthesis  │   Sequential
                    │  & Validation        │   (depends on 4)
                    └──────────┬───────────┘
                               ↓
                    ┌──────────────────────┐
                    │  Final Genome Output  │
                    │  + Design Tokens      │
                    │  + UI Analysis        │
                    │  + Audio Transcript   │
                    └──────────────────────┘
```

### 4.2 Agent 1: Frame Intelligence

**Purpose**: Extract video frames and deduplicate near-identical frames to produce a minimal set of unique screens.

**Algorithm**:

1. **Dense frame extraction**: Use ffmpeg to extract frames at a configurable interval (default: every 2 seconds), up to a maximum frame count (default: 40):
   ```
   ffmpeg -i {video} -vf fps=1/{interval} -frames:v {max} -q:v 2 frame_%04d.jpg
   ```

2. **Perceptual hash computation** (average-hash algorithm):
   - Convert frame to 8x8 grayscale image using PIL
   - Compute average pixel value across all 64 pixels
   - Generate 64-bit hash: each pixel → "1" if above average, "0" if below
   - Encode as hexadecimal string
   - Fallback: MD5 hash of raw bytes if PIL unavailable

3. **Hamming distance deduplication**:
   - Compare each frame's perceptual hash to the most recent unique frame
   - Compute Hamming distance: XOR the two hashes, count set bits
   - If distance > threshold (default: 6), frame is unique → new scene
   - If distance ≤ threshold, frame is a duplicate → skip

4. **Scene ID assignment**: Each unique frame receives an incrementing scene ID, enabling temporal grouping.

**Output**: `list[FrameInfo]` where each FrameInfo contains: `index`, `timestamp_sec`, `image_bytes`, `scene_id`, `is_unique`, `fingerprint`.

**Key innovation**: Perceptual hashing provides content-aware deduplication that is robust to minor visual changes (cursor movement, loading indicators) while detecting genuine screen transitions. This reduces vision API costs by 40-70% compared to sending all extracted frames.

### 4.3 Agent 2: UI Extraction

**Purpose**: Analyze each unique screen to extract detailed UI structure, design tokens, and HTML/CSS skeletons.

**Algorithm**:

1. **Batch construction**: Group frames into batches of up to 8 for efficient API usage
2. **Content block assembly**: For each batch, construct vision LLM content blocks:
   - Text instruction block describing the analysis task
   - Image blocks (base64-encoded JPEG) for each frame
   - Per-frame context labels: `[Screen {index} at {timestamp}s — Scene {scene_id}]`
   - Closing instruction block requesting structured JSON output
3. **Vision LLM call**: Send content blocks with specialized system prompt requesting:
   - `components`: hierarchical UI component list with positions
   - `color_palette`: hex codes with usage context (e.g., `{"hex": "#1a73e8", "usage": "primary button background"}`)
   - `typography`: font sizes, weights, and usage locations
   - `layout`: page structure type, column count, description
   - `html_skeleton`: semantic HTML with inline CSS representing the page layout
   - `text_labels`: all visible text (headings, buttons, menus)
   - `data_elements`: table columns, form field labels, dropdown options
   - `interactive_elements`: buttons, inputs, toggles with types and labels
4. **Response parsing**: Extract JSON from LLM response, handling markdown fences and embedded prose

**Output**: `list[ScreenAnalysis]` with full UI decomposition per screen.

**Key innovation**: Per-screen HTML/CSS skeleton generation from video frames enables visual replication of the source application — information not available through API-based extraction. Design tokens (colors, typography) capture the application's visual identity.

### 4.4 Agent 3: Audio/Speech

**Purpose**: Extract and transcribe audio narration, correlating spoken content with specific video frames.

**Algorithm**:

1. **Audio detection**: Use ffprobe to check for audio streams:
   ```
   ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 {video}
   ```

2. **Audio extraction**: Extract audio track to 16kHz mono WAV:
   ```
   ffmpeg -i {video} -vn -acodec pcm_s16le -ar 16000 -ac 1 -y {output.wav}
   ```

3. **Transcription**: Send WAV to OpenAI Whisper API with segment-level timestamps:
   - Model: whisper-1
   - Response format: verbose_json with segment granularity
   - Returns: full text, language detection, per-segment timestamps

4. **Frame correlation algorithm** (nearest-timestamp midpoint matching):
   - For each transcript segment, compute midpoint: `mid = (segment.start + segment.end) / 2`
   - Find the frame with the nearest timestamp: `argmin(|mid - frame_timestamp|)`
   - Build correlation map: `{frame_index: [text_segments]}`

**Output**: `TranscriptResult` with segments, full text, duration, language; plus `dict[int, list[str]]` correlation map.

**Key innovation**: Timestamp-based correlation between audio and video frames enables the system to associate spoken descriptions ("this is the approval workflow") with the specific screen being discussed, enriching structural extraction with context not visible in the UI.

### 4.5 Agent 4: Application Structure

**Purpose**: Synthesize UI analysis and audio transcript into a complete application genome.

**Algorithm**:

1. **Context assembly**: Build a structured prompt containing:
   - Per-screen UI analysis (components, data elements, interactive elements, text labels, layout)
   - Full audio transcript
   - Transcript-to-screen correlations (which words were spoken about which screen)

2. **LLM synthesis**: Send assembled context to LLM with specialized system prompt requesting:
   - `objects`: typed entities with descriptions and key fields (e.g., `{"name": "incident", "description": "Tracks IT disruptions", "key_fields": ["number", "priority"]}`)
   - `fields`: typed fields with object binding, validation rules, and optionality (e.g., `{"name": "priority", "type": "choice", "object": "incident", "options": [...]}`)
   - `workflows`: named processes with steps, triggers, and descriptions
   - `relationships`: typed connections with cardinality (e.g., `{"from": "incident", "to": "change", "type": "1:N"}`)
   - `navigation`: application menu structure
   - `roles_permissions`: observed access control patterns
   - `integrations`: external system references

3. **Response parsing**: Extract structured JSON, populate `AppStructureResult` dataclass

**Output**: `AppStructureResult` with typed objects, fields, workflows, relationships, navigation, roles, integrations, confidence score, and reasoning chain.

**Key innovation**: Cross-referencing visual UI elements with spoken audio descriptions produces a more complete genome than either signal alone. Objects mentioned in narration but not visible on screen are still captured (with lower confidence).

### 4.6 Agent 5: Synthesis & Validation

**Purpose**: Merge all agent outputs into a final validated genome with both backward-compatible and enriched representations.

**Algorithm**:

1. **Input aggregation**:
   - Application structure (objects, fields, workflows, relationships) from Agent 4
   - Aggregated design tokens (colors, typography, layouts) from Agent 2
   - Audio context summary from Agent 3

2. **LLM-based merge and validation**: Send aggregated inputs to LLM requesting:
   - Consistency validation (cross-reference UI observations with structural claims)
   - Duplicate resolution (merge overlapping objects/fields from different screens)
   - Confidence scoring (per-section reliability assessment)
   - Backward-compatible output: `genome_document` with flat string lists (objects, fields, workflows, relationships)
   - Enriched output: `structured_objects`, `structured_fields`, `structured_workflows`, `structured_relationships` with typed details
   - Design tokens: unified color palette with CSS variable suggestions, typography patterns, layout observations

3. **Fallback merge**: If LLM synthesis fails, perform mechanical merge:
   - Extract names from structured objects/fields/workflows
   - Build flat relationship strings from typed relationship objects
   - Aggregate color palettes from all screen analyses
   - Return with lower confidence score

**Output**: `SynthesisResult` with final genome dict, design tokens, validation notes, confidence score, and reasoning chain.

**Key innovation**: The fallback mechanical merge ensures the system always produces usable output even when the synthesis LLM call fails, providing graceful degradation.

### 4.7 Pipeline Orchestration and Progress Streaming

The orchestrator coordinates the five agents using Python's `asyncio`:

1. **Stage 1** (sequential): Frame Intelligence
2. **Stage 2** (parallel): UI Extraction + Audio/Speech via `asyncio.gather()`
3. **Stage 3** (sequential): Application Structure (depends on Stages 1+2)
4. **Stage 4** (sequential): Synthesis & Validation (depends on Stage 3)

Progress is streamed to the client via **Server-Sent Events (SSE)**:
- Each agent emits `running` and `done` (or `error`) events with metadata
- Events are bridged from the async pipeline to the SSE response via `asyncio.Queue`
- The client renders a real-time progress panel showing each agent's status

### 4.8 Extraction Metadata

Each extraction produces comprehensive metadata:
```json
{
  "_extraction_metadata": {
    "pipeline": "multi-agent-v1",
    "frame_count": 18,
    "unique_screens": 12,
    "has_audio": true,
    "audio_duration_sec": 45.3,
    "total_latency_ms": 67000,
    "stage_latencies": {
      "frame_intelligence": 2100,
      "ui_extraction_and_audio": 38000,
      "app_structure": 15000,
      "synthesis": 12000
    }
  }
}
```

---

## 5. Key Claims

### Independent Claims

**Claim 1.** A computer-implemented method for extracting an application genome from a video recording comprising:
(a) extracting a plurality of frames from the video recording at adaptive intervals;
(b) computing a perceptual hash for each extracted frame;
(c) deduplicating frames by comparing perceptual hashes using Hamming distance thresholding to produce a set of unique screens;
(d) analyzing each unique screen using a vision language model to extract UI components, color palettes, typography patterns, layout structure, and an HTML/CSS skeleton;
(e) extracting and transcribing audio from the video recording with segment-level timestamps;
(f) correlating audio transcript segments to video frames by timestamp midpoint matching;
(g) synthesizing the UI analysis and correlated audio transcript into a structured application genome comprising typed objects, fields, workflows, and relationships;
(h) validating and merging the synthesized genome into a final output with confidence scoring.

**Claim 2.** A multi-agent system for video-based application genome extraction comprising:
(a) a frame intelligence agent configured to extract frames, compute perceptual hashes, and deduplicate frames using Hamming distance;
(b) a UI extraction agent configured to analyze frames using a vision language model and produce per-screen HTML/CSS skeletons, color palettes, and component hierarchies;
(c) an audio/speech agent configured to extract audio, transcribe with timestamps, and correlate transcript segments to frames;
(d) an application structure agent configured to synthesize UI analysis and audio transcript into typed application structure;
(e) a synthesis agent configured to merge all agent outputs, validate consistency, and produce a final genome;
(f) an orchestrator configured to execute agents (b) and (c) in parallel and stream progress via server-sent events.

**Claim 3.** A method for perceptual hash-based video frame deduplication for vision API cost optimization comprising:
(a) extracting frames at regular intervals from a video;
(b) for each frame, converting to grayscale, downscaling to an N×N grid, computing average pixel value, and generating a binary hash where each bit indicates whether a pixel exceeds the average;
(c) computing Hamming distance between consecutive frame hashes;
(d) retaining only frames whose Hamming distance from the most recent retained frame exceeds a threshold;
(e) assigning scene identifiers to retained frames.

### Dependent Claims

**Claim 4.** The method of Claim 1 wherein the perceptual hash is an average-hash computed over an 8×8 grayscale downscale of the frame.

**Claim 5.** The method of Claim 1 wherein the UI extraction produces design tokens comprising color hex codes with usage descriptions, typography patterns, and CSS variable suggestions.

**Claim 6.** The method of Claim 1 wherein the audio transcript correlation uses nearest-neighbor matching of transcript segment midpoint timestamps to frame extraction timestamps.

**Claim 7.** The method of Claim 1 wherein the application structure synthesis cross-references spoken audio descriptions with visual UI observations, capturing objects mentioned in narration but not visible on screen.

**Claim 8.** The system of Claim 2 wherein the orchestrator uses an asyncio queue to bridge agent progress events to the SSE response stream.

**Claim 9.** The method of Claim 1 further comprising a fallback mechanical merge that produces a valid genome output without LLM synthesis when the synthesis agent fails.

**Claim 10.** The method of Claim 1 wherein the final genome output comprises both backward-compatible flat string lists and enriched structured representations with typed fields, relationships with cardinality, and workflows with steps.

**Claim 11.** The system of Claim 2 further comprising a persistent extraction record storing the genome, UI analysis, audio transcript, design tokens, agent progress, and extraction metadata.

**Claim 12.** The method of Claim 1 wherein the HTML/CSS skeleton generation produces semantic HTML with inline styles sufficient to recreate the visual layout of each screen.

**Claim 13.** The method of Claim 3 wherein a fallback hash is computed using MD5 of the raw frame bytes when the image processing library is unavailable.

**Claim 14.** The method of Claim 1 further comprising streaming per-agent progress events to the client in real-time during extraction.

**Claim 15.** The system of Claim 2 wherein the UI extraction agent processes frames in configurable batches to stay within vision API token limits.

**Claim 16.** The method of Claim 1 wherein the video recording requires no API access to the source application, enabling genome extraction from any recorded application walkthrough.

**Claim 17.** The method of Claim 1 further comprising extracting interactive elements (buttons, inputs, toggles) with their labels and visual styles from each screen.

**Claim 18.** The system of Claim 2 wherein extraction results are stored with mandatory taxonomy fields (vendor, product area) and optional module field, enabling organized repository storage.

**Claim 19.** The method of Claim 1 further comprising per-section confidence scoring in the final genome output, indicating reliability of each extracted component.

**Claim 20.** A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of Claim 1.

---

## 6. Advantages Over Prior Art

1. **No API access required**: Extracts application structure from video recordings, enabling genome extraction from any application that can be screen-recorded — including applications with restricted API access
2. **Multi-signal correlation**: Combines visual (UI layout, colors, components) and auditory (narration, feature descriptions) signals for more complete extraction than either alone
3. **UI design capture**: Extracts visual design details (color palettes, typography, HTML/CSS patterns) that are not available through API-based extraction
4. **Cost-optimized vision analysis**: Perceptual hash deduplication reduces vision API costs by 40-70% by eliminating near-duplicate frames
5. **Parallel agent execution**: UI extraction and audio transcription run concurrently, reducing total pipeline latency
6. **Graceful degradation**: Fallback mechanical merge ensures output even when LLM synthesis fails; audio agent degrades gracefully if no audio track or no Whisper API key
7. **Real-time progress visibility**: SSE streaming provides users with live feedback on each agent's status
8. **Backward compatibility**: Output includes both flat string lists (compatible with existing systems) and enriched structured representations

---

## 7. Drawings/Figures Description

**Figure 1: Multi-Agent Pipeline DAG** — Directed acyclic graph showing the five agents with sequential and parallel edges, data flow between agents, and stage numbering.

**Figure 2: Perceptual Hash Computation** — Step-by-step diagram showing: original frame → 8×8 grayscale → pixel values → average computation → binary hash → hex encoding.

**Figure 3: Hamming Distance Deduplication** — Timeline showing extracted frames, their perceptual hashes, computed Hamming distances, and which frames are retained vs. skipped.

**Figure 4: Audio-to-Frame Correlation** — Timeline showing audio segments with timestamps aligned to video frames, with correlation arrows from segment midpoints to nearest frames.

**Figure 5: Per-Screen UI Extraction Output** — Example screen analysis showing the original frame alongside extracted components, color palette swatches, HTML skeleton, and interactive elements.

**Figure 6: Multi-Signal Synthesis** — Diagram showing how UI analysis (visual signal) and audio transcript (auditory signal) are combined to produce richer structural output than either alone.

**Figure 7: SSE Progress Streaming Architecture** — Sequence diagram showing the asyncio.Queue bridge between pipeline agents and the SSE response stream.

**Figure 8: Final Genome Output Structure** — Diagram showing the dual output: backward-compatible flat lists alongside enriched structured representations with design tokens.

---

## 8. Inventors

[To be completed by filing attorney]

## 9. Filing Notes

- The multi-agent architecture with parallel execution and SSE streaming is a strong system claim
- The perceptual hashing algorithm for frame deduplication may warrant independent continuation claims
- The audio-to-frame correlation algorithm (nearest-timestamp midpoint matching) is a novel method claim
- Consider international filing given the global enterprise software market
- Prior art search should focus on: video analysis for UI testing (different purpose), screen recording tools (no structural extraction), automated documentation (typically from code, not video)

---

*This document is a technical disclosure for patent filing purposes. It should be reviewed by a registered patent attorney before formal claims are drafted and filed.*
