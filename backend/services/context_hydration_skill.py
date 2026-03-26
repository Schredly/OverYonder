"""ContextHydrationSkill — Iterative file-retrieval skill for genome transformations.

Execution model:
  1. Initialise with genome.index.json + user request
  2. Loop:
       a. Call LLM with current context
       b. Parse response → required_files | ready signal
       c. Fetch files from GitHub (deduplicated)
       d. Append content to context
       e. Track usage
  3. Exit when LLM returns READY_TO_BUILD (required_files empty or ready: true)
  4. Return HydrationContext — ready to hand off to any synthesis step

This skill runs BEFORE a synthesis/build step and is independent of the
specific output format that step produces. It only accumulates context.

Integration with existing orchestrator:
  - Emits events using the same signature as services/orchestrator.py:
      emit(skill_id, event_type, summary, confidence?, metadata?)
  - Returns HydrationContext, which is stored in the use-case run state
    under the key "hydration_context" and passed to the next step

New execution mode label: "iterative_context"
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from providers.github_provider import list_tree, get_file
from services.claude_client import call_llm_multi_turn
from services.hydration_guard import Guard

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_ITERATIONS: int = 5           # max retrieval rounds before forcing READY
MAX_FILES_PER_ITERATION: int = 5  # files LLM may request per round
MAX_CONTEXT_CHARS: int = 120_000  # total accumulated chars before forcing READY
MAX_FILE_CHARS: int = 8_000       # per-file content cap

SKILL_ID = "context_hydration"

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class HydrationIteration:
    """Captures the state of a single retrieval round."""
    round_num: int
    plan: list[str]               # LLM's stated plan for this round
    files_requested: list[str]    # files LLM asked for
    files_fetched: list[str]      # paths successfully loaded
    files_failed: list[str]       # paths that errored
    chars_added: int              # chars appended to context this round
    input_tokens: int             # LLM input tokens this round
    output_tokens: int            # LLM output tokens this round
    latency_ms: int               # LLM call latency


@dataclass
class HydrationContext:
    """Accumulated context after the retrieval loop completes.

    This is the output of ContextHydrationSkill and the input to
    any downstream synthesis step (e.g. SynthesizeResolutionSkill).
    """
    genome_path: str
    user_request: str

    # Loaded file contents — deduplicated, keyed by relative path
    loaded_files: dict[str, str] = field(default_factory=dict)

    # Per-round iteration records
    iterations: list[HydrationIteration] = field(default_factory=list)

    # Cumulative totals
    total_chars: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_latency_ms: int = 0

    # LLM's accumulated plan across all rounds
    accumulated_plan: list[str] = field(default_factory=list)

    # Readiness state
    ready: bool = False
    ready_reason: str = ""        # LLM's stated reason for being ready

    # GitHub metadata
    file_tree: list[dict] = field(default_factory=list)
    index_json: dict | None = None  # parsed genome.index.json (if present)

    # Conversation history for optional hand-off to synthesis step
    messages: list[dict] = field(default_factory=list)
    system_prompt: str = ""

    def formatted_context(self) -> str:
        """Return all loaded file contents as a single concatenated string."""
        parts = []
        for path, content in self.loaded_files.items():
            parts.append(f"--- FILE: {path} ---\n{content}")
        return "\n\n".join(parts)

    def summary(self) -> dict:
        """Return a concise summary dict for logging / event emission."""
        return {
            "genome_path": self.genome_path,
            "files_loaded": len(self.loaded_files),
            "total_chars": self.total_chars,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "iterations": len(self.iterations),
            "ready": self.ready,
        }


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_HYDRATION_SYSTEM = """\
You are a context retrieval agent for the OverYonder genome platform.

Your ONLY job in this phase is to retrieve the files you need to fully understand
the genome before any application is built. You do NOT produce app specs here.

## CRITICAL RULE — RETRIEVAL BEFORE BUILD

You MUST NOT signal readiness or produce any output immediately.
You MUST first:

1. Analyze the entity index (genome.index.json)
2. Identify which structure files contain the information you need
3. Request those files via required_files

Only signal ready AFTER you have fetched and read at least one structure file.
If you violate this rule your response WILL BE REJECTED and you must retry.

## PROTOCOL

Respond with ONLY valid JSON. Choose one shape per response:

### Shape 1 — Request more files (required in round 1)
{
  "plan": ["What you are doing this round and why"],
  "required_files": ["structure/entities.json", "structure/workflows.json"]
}

Constraints:
- At most 5 files per round
- Only request paths visible in the file tree
- Prefer structure/* and genome.yaml over raw data files
- Deduplication is automatic — do not re-request files already loaded

### Shape 2 — Signal readiness (only after fetching at least one structure file)
{
  "plan": ["Summary of what you have learned"],
  "ready": true,
  "reason": "Brief explanation of why you have enough context to build"
}

You MAY signal ready when:
- You have loaded all files relevant to the user's request
- OR the context budget is full
- OR you have nothing more to request (and already fetched ≥1 structure file)

Return ONLY valid JSON. No prose, no markdown fences around the JSON.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_file_tree(tree: list[dict], prefix: str = "") -> list[dict]:
    """Flatten a GitHub tree into {path, name, type} entries."""
    entries = []
    for node in tree:
        path = f"{prefix}/{node['name']}" if prefix else node["name"]
        entries.append({"path": path, "name": node["name"], "type": node.get("type", "file")})
        if node.get("children"):
            entries.extend(_build_file_tree(node["children"], path))
    return entries


def _format_tree(entries: list[dict]) -> str:
    lines = []
    for e in entries:
        depth = e["path"].count("/")
        indent = "  " * depth
        icon = "dir" if e["type"] in ("dir", "folder") else "file"
        lines.append(f"{indent}{icon}: {e['name']}")
    return "\n".join(lines)


def _parse_response(raw: str) -> dict | None:
    """Extract JSON from LLM response, tolerating markdown fences."""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    if start >= 0:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break
    return None


# ---------------------------------------------------------------------------
# Skill class
# ---------------------------------------------------------------------------

class ContextHydrationSkill:
    """Iterative context retrieval skill.

    Runs BEFORE any synthesis/build step. Accumulates exactly the file
    context needed for the user's request, nothing more.

    Usage::

        skill = ContextHydrationSkill()
        ctx = await skill.run(
            genome_path="genomes/tenants/acme/vendors/servicenow/beach_bum/rentals",
            user_request="Convert this genome to a Replit app",
            llm_cfg={"provider": "anthropic", "api_key": "...", "model": "claude-sonnet-4-6"},
            app=fastapi_app,
            emit=my_emit_fn,        # optional — same signature as orchestrator emit()
            extra_system="",        # optional — append to system prompt (e.g. translation recipe)
        )

        # ctx.ready == True means LLM has enough context
        # ctx.loaded_files — all fetched file contents
        # ctx.messages — full conversation history for hand-off to synthesis step
    """

    def __init__(
        self,
        max_iterations: int = MAX_ITERATIONS,
        max_files_per_iteration: int = MAX_FILES_PER_ITERATION,
        max_context_chars: int = MAX_CONTEXT_CHARS,
        max_file_chars: int = MAX_FILE_CHARS,
        tenant: str = "acme",
    ):
        self.max_iterations = max_iterations
        self.max_files_per_iteration = max_files_per_iteration
        self.max_context_chars = max_context_chars
        self.max_file_chars = max_file_chars
        self.tenant = tenant

    async def run(
        self,
        genome_path: str,
        user_request: str,
        llm_cfg: dict,
        app: Any,
        emit: Callable[..., Coroutine] | None = None,
        extra_system: str = "",
    ) -> HydrationContext:
        """Execute the iterative retrieval loop.

        Args:
            genome_path:   GitHub base path for the genome.
            user_request:  The user's transformation/build intent.
            llm_cfg:       {"provider", "api_key", "model"}.
            app:           FastAPI app (for GitHub provider access).
            emit:          Optional event emitter matching orchestrator signature:
                           emit(skill_id, event_type, summary, confidence, metadata)
            extra_system:  Additional system prompt text (e.g. a translation recipe).

        Returns:
            HydrationContext with all loaded files and readiness signal.
        """
        ctx = HydrationContext(genome_path=genome_path, user_request=user_request)
        guard = Guard()

        async def _emit(event_type: str, summary: str, metadata: dict | None = None) -> None:
            if emit:
                await emit(SKILL_ID, event_type, summary, None, metadata)

        await _emit("thinking", f"Initialising context hydration for: {genome_path}")

        # -- Step 1: Build file tree ----------------------------------------
        await _emit("retrieval", "Listing repository files...")
        raw_tree = await list_tree(self.tenant, genome_path, app, depth=8)
        file_entries = _build_file_tree(raw_tree)
        file_only = [e for e in file_entries if e["type"] not in ("dir", "folder")]
        ctx.file_tree = file_entries
        tree_str = _format_tree(file_entries)

        await _emit("retrieval", f"File tree built: {len(file_only)} files found",
                    {"file_count": len(file_only)})

        # -- Step 2: Fetch genome.index.json if present ---------------------
        index_json_path = f"{genome_path}/genome.index.json"
        index_json_str: str | None = None
        if any(e["name"] == "genome.index.json" for e in file_entries):
            try:
                index_data = await get_file(self.tenant, index_json_path, app)
                if index_data and index_data.get("content"):
                    raw_content = index_data["content"][: self.max_file_chars]
                    ctx.loaded_files["genome.index.json"] = raw_content
                    ctx.total_chars += len(raw_content)
                    try:
                        ctx.index_json = json.loads(raw_content)
                    except json.JSONDecodeError:
                        pass
                    index_json_str = raw_content
                    await _emit("retrieval", "Loaded genome.index.json (entity index)",
                                {"path": "genome.index.json", "size": len(raw_content)})
            except Exception as exc:
                logger.debug("[hydration_skill] genome.index.json unavailable: %s", exc)

        # -- Step 3: Build system prompt + initial message ------------------
        system = _HYDRATION_SYSTEM
        if extra_system:
            system += f"\n\n{extra_system}"
        ctx.system_prompt = system

        first_msg_parts = [
            f"## GENOME: {genome_path}",
            f"\nRepository file tree ({len(file_only)} files):\n```\n{tree_str}\n```",
        ]
        if index_json_str:
            first_msg_parts.append(
                f"\n## ENTITY INDEX (genome.index.json)\n```json\n{index_json_str}\n```\n"
                "The entity index maps forms, workflows, tables, and UI components to their file paths."
            )
        else:
            first_msg_parts.append("\nNo genome.index.json found — start with genome.yaml or structure files.")

        first_msg_parts.append(f"\n## USER REQUEST\n{user_request}")
        first_msg_parts.append(
            "\nAnalyse the entity index and declare your retrieval plan. "
            "Respond with {\"plan\": [...], \"required_files\": [...]} to start fetching, "
            "or {\"plan\": [...], \"ready\": true, \"reason\": \"...\"} if you already have enough context."
        )

        ctx.messages = [{"role": "user", "content": "\n".join(first_msg_parts)}]

        # -- Step 4: Retrieval loop ----------------------------------------
        for round_num in range(1, self.max_iterations + 1):
            await _emit("planning", f"Round {round_num}: calling LLM...")

            # Force ready on final round
            if round_num == self.max_iterations:
                ctx.messages.append({
                    "role": "user",
                    "content": (
                        f"FINAL ROUND. You MUST signal readiness now. "
                        f"Respond with {{\"plan\": [...], \"ready\": true, \"reason\": \"...\"}}."
                    ),
                })

            t0 = time.monotonic()
            try:
                raw_response, meta = await call_llm_multi_turn(
                    provider=llm_cfg["provider"],
                    api_key=llm_cfg["api_key"],
                    model=llm_cfg["model"],
                    messages=ctx.messages,
                    system_prompt=system,
                    max_tokens=2048,  # retrieval responses are small
                )
            except Exception as exc:
                logger.error("[hydration_skill] LLM call failed round %d: %s", round_num, exc)
                ctx.ready = True
                ctx.ready_reason = f"LLM error: {exc}"
                break

            latency_ms = int((time.monotonic() - t0) * 1000)
            input_tokens = meta.get("input_tokens") or 0
            output_tokens = meta.get("output_tokens") or 0
            ctx.total_input_tokens += input_tokens
            ctx.total_output_tokens += output_tokens
            ctx.total_latency_ms += latency_ms

            ctx.messages.append({"role": "assistant", "content": raw_response})

            parsed = _parse_response(raw_response)
            if parsed is None:
                logger.warning("[hydration_skill] Round %d: non-JSON response", round_num)
                iteration = HydrationIteration(
                    round_num=round_num, plan=["[parse error]"],
                    files_requested=[], files_fetched=[], files_failed=[],
                    chars_added=0, input_tokens=input_tokens,
                    output_tokens=output_tokens, latency_ms=latency_ms,
                )
                ctx.iterations.append(iteration)
                ctx.ready = True
                ctx.ready_reason = "LLM returned non-JSON"
                break

            plan = parsed.get("plan", [])
            if isinstance(plan, str):
                plan = [plan]
            ctx.accumulated_plan.extend(plan)

            # --- Guard: reject premature readiness/build signals ---
            files_fetched_in_loop = sum(len(it.files_fetched) for it in ctx.iterations)
            guard_result = guard.validate(
                parsed, files_fetched_in_loop=files_fetched_in_loop, round_num=round_num
            )
            if guard_result.rejected:
                logger.warning(
                    "[hydration_skill] Round %d: guard rejected — %s",
                    round_num, guard_result.reason,
                )
                await _emit("thinking",
                            f"Round {round_num}: rejected premature signal ({guard_result.reason}) — retrying",
                            {"round": round_num, "rejection": guard_result.reason})
                ctx.messages.append({"role": "user", "content": guard_result.correction_message})
                continue

            # Check for readiness signal
            if parsed.get("ready") or not parsed.get("required_files"):
                reason = parsed.get("reason", "LLM signalled no further files needed")
                ctx.ready = True
                ctx.ready_reason = reason
                iteration = HydrationIteration(
                    round_num=round_num, plan=plan,
                    files_requested=[], files_fetched=[], files_failed=[],
                    chars_added=0, input_tokens=input_tokens,
                    output_tokens=output_tokens, latency_ms=latency_ms,
                )
                ctx.iterations.append(iteration)
                await _emit("complete",
                            f"READY_TO_BUILD after {round_num} round(s): {reason}",
                            ctx.summary())
                break

            # Fetch requested files
            requested = parsed["required_files"][: self.max_files_per_iteration]
            new_paths = [p for p in requested if p not in ctx.loaded_files]  # deduplicate

            await _emit("retrieval",
                        f"Round {round_num}: fetching {len(new_paths)} file(s)...",
                        {"plan": plan, "files": new_paths})

            fetched_paths: list[str] = []
            failed_paths: list[str] = []
            chars_added = 0
            fetched_blocks: list[str] = []

            for rel_path in new_paths:
                full_path = (
                    rel_path if rel_path.startswith(genome_path)
                    else f"{genome_path}/{rel_path}"
                )
                try:
                    file_data = await get_file(self.tenant, full_path, app)
                    content = (file_data.get("content", "") if file_data else "")[: self.max_file_chars]
                    ctx.loaded_files[rel_path] = content
                    ctx.total_chars += len(content)
                    chars_added += len(content)
                    fetched_paths.append(rel_path)
                    fetched_blocks.append(f"--- FILE: {rel_path} ({len(content)} chars) ---\n{content}")
                    await _emit("tool_result", f"Fetched: {rel_path}",
                                {"path": rel_path, "size": len(content), "round": round_num})
                except Exception as exc:
                    failed_paths.append(rel_path)
                    fetched_blocks.append(f"--- FILE: {rel_path} ---\n[Error: {exc}]")
                    logger.debug("[hydration_skill] fetch failed %s: %s", rel_path, exc)

            iteration = HydrationIteration(
                round_num=round_num, plan=plan,
                files_requested=new_paths, files_fetched=fetched_paths,
                files_failed=failed_paths, chars_added=chars_added,
                input_tokens=input_tokens, output_tokens=output_tokens,
                latency_ms=latency_ms,
            )
            ctx.iterations.append(iteration)

            # Append fetched content to conversation
            next_content = "Here are the requested files:\n\n" + "\n\n".join(fetched_blocks)

            if ctx.total_chars > self.max_context_chars:
                next_content += (
                    f"\n\nCONTEXT BUDGET REACHED ({ctx.total_chars:,} chars). "
                    "Signal readiness now: {\"plan\": [...], \"ready\": true, \"reason\": \"...\"}."
                )

            ctx.messages.append({"role": "user", "content": next_content})
        else:
            # Loop exhausted without a break — mark ready anyway
            if not ctx.ready:
                ctx.ready = True
                ctx.ready_reason = f"Max iterations ({self.max_iterations}) reached"
                await _emit("complete",
                            f"Hydration complete (max iterations): {len(ctx.loaded_files)} files loaded",
                            ctx.summary())

        logger.info(
            "[hydration_skill] Done — %d files, %d rounds, %d input tokens, %d output tokens",
            len(ctx.loaded_files), len(ctx.iterations),
            ctx.total_input_tokens, ctx.total_output_tokens,
        )
        return ctx


# ---------------------------------------------------------------------------
# Convenience: standalone synthesis prompt builder
# ---------------------------------------------------------------------------

def build_synthesis_prompt(ctx: HydrationContext, synthesis_instructions: str = "") -> str:
    """Build the initial user message for the downstream synthesis step.

    Takes the HydrationContext produced by ContextHydrationSkill and formats
    all accumulated context into a single prompt that a synthesis LLM call
    (e.g. SynthesizeResolutionSkill) can consume.

    Args:
        ctx:                     Completed HydrationContext.
        synthesis_instructions:  Task-specific instructions to prepend.

    Returns:
        A fully-formed user message string.
    """
    parts: list[str] = []

    if synthesis_instructions:
        parts.append(f"## TASK\n{synthesis_instructions}\n")

    parts.append(
        f"## GENOME CONTEXT\nPath: {ctx.genome_path}\n"
        f"Files loaded: {len(ctx.loaded_files)}\n"
        f"Retrieval plan:\n" + "\n".join(f"- {p}" for p in ctx.accumulated_plan)
    )

    if ctx.index_json:
        parts.append(
            "## ENTITY INDEX\n```json\n"
            + json.dumps(ctx.index_json, indent=2)[:4000]
            + "\n```"
        )

    if ctx.loaded_files:
        parts.append("## LOADED FILES\n" + ctx.formatted_context())

    parts.append(
        "\nUsing the context above, now produce the requested output. "
        "Follow the filesystem_plan output format."
    )

    return "\n\n".join(parts)
