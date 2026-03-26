"""XMLHydrationLoop — iterative context retrieval for ServiceNow update set XML.

Mirrors the GitHub hydration loop but operates entirely on locally-parsed XML
records. Instead of fetching files from GitHub, it returns slices of the parsed
XML grouped by record type.

Pipeline position:
    parse_update_sets() → XMLHydrationLoop.run() → extract_sn_genome(focused_xml)

The loop:
  1. Builds an index of record types with counts and sample names
  2. Auto-includes high-priority types (catalog, workflows, scripts) within budget
  3. LLM optionally requests additional types
  4. Accumulates focused XML — only the records the LLM needs
  5. Signals READY when it has enough context
  6. Returns focused_xml → fed into the existing genome extraction agent

Thresholds:
  SMALL  (< 50 records)  — single-pass, no loop needed
  MEDIUM (50–300 records) — loop with auto-include
  LARGE  (300+ records)  — loop required, strict budget
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field

from services.claude_client import call_llm_multi_turn
from services.hydration_guard import Guard

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Thresholds and configuration
# ---------------------------------------------------------------------------

SMALL_THRESHOLD = 50        # records — skip loop entirely
LOOP_THRESHOLD = 50         # records — enable loop above this
MAX_CHARS_PER_TYPE = 40_000 # chars returned per record type slice
MAX_TOTAL_CHARS = 100_000   # total focused XML sent to extraction agent
MAX_ITERATIONS = 5
MAX_TYPES_PER_ROUND = 5
MAX_RETRIES = 2

# Record types critical for genome quality — always included first within budget
HIGH_PRIORITY_TYPES = [
    "sys_catalog_item", "sc_cat_item", "sc_cat_item_producer",
    "wf_workflow", "wf_activity", "wf_stage",
    "sys_script", "sys_business_rule", "sys_script_include",
    "sys_db_object",
    "sys_app_module", "sys_app",
    "item_option_new",       # catalog variables
    "sc_item_option",
    "sys_ui_policy", "sys_ui_action",
    "sys_process_guide",
]

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class XMLHydrationResult:
    """Output of XMLHydrationLoop.run()."""
    focused_xml: str                    # the XML to pass to extract_sn_genome
    types_included: list[str]           # record types that made it into focused_xml
    types_available: int                # total distinct types in the update set
    records_included: int               # total records in focused_xml
    total_records: int                  # total records in the update set
    total_chars: int                    # chars in focused_xml
    iterations: int                     # retrieval rounds used
    total_input_tokens: int
    total_output_tokens: int
    used_loop: bool                     # False = single-pass (small update set)
    skipped_types: list[str]            # types available but not included


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_XML_SYSTEM = """\
You are a ServiceNow update set analyst for the OverYonder genome platform.

Your job is to identify which XML record types are needed to extract a complete
application genome. You operate in a RETRIEVAL LOOP — you see an index of available
record types and request only what you need.

## CRITICAL RULE — RETRIEVAL BEFORE BUILD

You MUST NOT signal readiness immediately. You MUST:
1. Analyze the record type index
2. Identify which types are needed for a complete genome
3. Request additional types beyond what was auto-included

Only signal ready AFTER you have reviewed the high-priority types already loaded
AND requested any additional types you need.

## PROTOCOL

Respond with ONLY valid JSON. Choose one shape:

### Shape 1 — Request more record types
{
  "plan": ["Why you need these types and what genome sections they cover"],
  "required_files": ["sys_security_acl", "sys_choice", "sys_ui_message"]
}

Rules:
- At most 5 types per round
- Only request types listed in the AVAILABLE TYPES section
- Auto-included types are already loaded — do not re-request them
- Focus on types needed for: entities, relationships, data model, integrations

### Shape 2 — Signal readiness
{
  "plan": ["Summary of what record types cover the genome completely"],
  "ready": true,
  "reason": "All critical types loaded — catalog, workflows, business rules, data model covered"
}

Return ONLY valid JSON. No markdown, no prose outside the JSON.
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_xml_index(
    type_summary: dict[str, dict],
    auto_included: list[str],
    available: list[str],
    total_records: int,
) -> str:
    """Format the record type index shown to the LLM."""
    lines = [
        f"UPDATE SET RECORD INDEX",
        f"Total records: {total_records}",
        f"Distinct record types: {len(type_summary)}",
        "",
        "AUTO-INCLUDED TYPES (already in context):",
    ]
    for t in auto_included:
        info = type_summary.get(t, {})
        count = info.get("count", 0)
        names = info.get("names", [])
        name_str = ", ".join(names[:5])
        suffix = f" — e.g. {name_str}" if name_str else ""
        lines.append(f"  {t}: {count} records{suffix}")

    if available:
        lines += ["", "AVAILABLE TYPES (request if needed):"]
        for t in available:
            info = type_summary.get(t, {})
            count = info.get("count", 0)
            lines.append(f"  {t}: {count} records")

    return "\n".join(lines)


def _records_to_xml(records_by_type: dict[str, list[str]], type_name: str, max_chars: int) -> str:
    """Return XML string for a record type, capped at max_chars."""
    records = records_by_type.get(type_name, [])
    if not records:
        return f"<!-- No records found for type: {type_name} -->"
    parts = [f"<!-- {type_name}: {len(records)} records -->"]
    chars = len(parts[0])
    for rec in records:
        if chars + len(rec) > max_chars:
            remaining = len(records) - len(parts) + 1
            parts.append(f"<!-- ... {remaining} more {type_name} records truncated -->")
            break
        parts.append(rec)
        chars += len(rec)
    return "\n".join(parts)


def _parse_llm_response(raw: str) -> dict | None:
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
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break
    return None


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

class XMLHydrationLoop:
    """Iterative retrieval loop for ServiceNow XML update sets.

    For small update sets (< LOOP_THRESHOLD records), bypasses the loop and
    returns focused_xml directly from the high-priority auto-include pass.

    For large update sets, uses an LLM-driven loop to identify which record
    types are needed for a complete genome before extraction.
    """

    def __init__(
        self,
        max_iterations: int = MAX_ITERATIONS,
        max_types_per_round: int = MAX_TYPES_PER_ROUND,
        max_chars_per_type: int = MAX_CHARS_PER_TYPE,
        max_total_chars: int = MAX_TOTAL_CHARS,
    ):
        self.max_iterations = max_iterations
        self.max_types_per_round = max_types_per_round
        self.max_chars_per_type = max_chars_per_type
        self.max_total_chars = max_total_chars

    async def run(
        self,
        records_by_type: dict[str, list[str]],
        type_summary: dict[str, dict],
        total_records: int,
        llm_cfg: dict,
        user_notes: str = "",
        product_area: str = "",
        module: str = "",
        on_progress=None,
    ) -> XMLHydrationResult:
        """Run the XML hydration loop.

        Args:
            records_by_type:  {tag: [xml_string, ...]} from xml_parser
            type_summary:     {tag: {"count": int, "names": [str]}} from xml_parser
            total_records:    Total record count across all types
            llm_cfg:          {"provider", "api_key", "model"}
            user_notes:       User context for extraction
            product_area:     e.g. "IT Service Management"
            module:           e.g. "Hardware Requests"
            on_progress:      Async callback(agent, status, data)

        Returns:
            XMLHydrationResult with focused_xml ready for extract_sn_genome
        """
        async def _progress(status: str, data: dict) -> None:
            if on_progress:
                await on_progress("xml_hydration", status, data)

        await _progress("running", {"total_records": total_records, "total_types": len(type_summary)})

        all_types = list(records_by_type.keys())

        # ── Small update set: skip loop entirely ──────────────────────────
        if total_records <= LOOP_THRESHOLD:
            logger.info("[xml_hydration] Small update set (%d records) — single pass", total_records)
            focused_parts, included = self._auto_include(records_by_type, all_types, budget=self.max_total_chars)
            focused_xml = "\n\n".join(focused_parts)
            await _progress("done", {"used_loop": False, "types_included": len(included)})
            return XMLHydrationResult(
                focused_xml=focused_xml,
                types_included=included,
                types_available=len(all_types),
                records_included=sum(type_summary.get(t, {}).get("count", 0) for t in included),
                total_records=total_records,
                total_chars=len(focused_xml),
                iterations=0,
                total_input_tokens=0,
                total_output_tokens=0,
                used_loop=False,
                skipped_types=[t for t in all_types if t not in included],
            )

        # ── Large update set: loop ────────────────────────────────────────
        logger.info("[xml_hydration] Large update set (%d records, %d types) — loop mode",
                    total_records, len(type_summary))

        # Step 1: Auto-include high-priority types within half the budget
        auto_parts, auto_included = self._auto_include(
            records_by_type, HIGH_PRIORITY_TYPES, budget=self.max_total_chars // 2
        )
        auto_chars = sum(len(p) for p in auto_parts)

        # Track what's been loaded and what's still available
        loaded_types: set[str] = set(auto_included)
        loaded_parts: list[str] = list(auto_parts)
        total_chars = auto_chars

        remaining_types = [t for t in all_types if t not in loaded_types]

        await _progress("auto_included", {
            "types": auto_included,
            "chars": auto_chars,
            "remaining_types": len(remaining_types),
        })

        # Step 2: Build index for LLM
        index_str = _format_xml_index(type_summary, auto_included, remaining_types, total_records)

        context_note = ""
        if product_area:
            context_note += f"Product area: {product_area}\n"
        if module:
            context_note += f"Module: {module}\n"
        if user_notes:
            context_note += f"Context: {user_notes}\n"

        first_msg = (
            f"{index_str}\n\n"
            f"{context_note}\n"
            "Review the auto-included types above. Request any additional record types "
            "needed for a complete genome — data model, integrations, security, choices. "
            "Respond with {\"plan\": [...], \"required_files\": [...]} or signal ready."
        )

        messages: list[dict] = [{"role": "user", "content": first_msg}]
        total_input_tokens = 0
        total_output_tokens = 0
        iterations = 0
        guard = Guard(max_retries=MAX_RETRIES)
        files_fetched_in_loop = 0

        # Step 3: Retrieval loop
        for round_num in range(1, self.max_iterations + 1):
            if round_num == self.max_iterations:
                messages.append({
                    "role": "user",
                    "content": "FINAL ROUND. Signal readiness now: {\"plan\": [...], \"ready\": true, \"reason\": \"...\"}",
                })

            t0 = time.monotonic()
            try:
                raw, meta = await call_llm_multi_turn(
                    provider=llm_cfg["provider"],
                    api_key=llm_cfg["api_key"],
                    model=llm_cfg["model"],
                    messages=messages,
                    system_prompt=_XML_SYSTEM,
                    max_tokens=1024,  # responses are small — just type names
                )
            except Exception as exc:
                logger.error("[xml_hydration] LLM call failed round %d: %s", round_num, exc)
                break

            latency_ms = int((time.monotonic() - t0) * 1000)
            total_input_tokens += meta.get("input_tokens") or 0
            total_output_tokens += meta.get("output_tokens") or 0
            iterations += 1

            messages.append({"role": "assistant", "content": raw})

            parsed = _parse_llm_response(raw)
            if parsed is None:
                logger.warning("[xml_hydration] Round %d: non-JSON response", round_num)
                break

            # Guard: reject premature readiness
            guard_result = guard.validate(parsed, files_fetched_in_loop=files_fetched_in_loop, round_num=round_num)
            if guard_result.rejected:
                logger.warning("[xml_hydration] Round %d: guard rejected — %s", round_num, guard_result.reason)
                messages.append({"role": "user", "content": guard_result.correction_message})
                await _progress("guard_rejection", {"round": round_num, "reason": guard_result.reason})
                continue

            # Readiness signal
            if parsed.get("ready") or not parsed.get("required_files"):
                reason = parsed.get("reason", "LLM signalled ready")
                logger.info("[xml_hydration] READY after %d round(s): %s", round_num, reason)
                await _progress("ready", {"round": round_num, "reason": reason})
                break

            # Fetch requested types
            requested = [
                t for t in (parsed.get("required_files") or [])[:self.max_types_per_round]
                if t in records_by_type and t not in loaded_types
            ]

            if not requested:
                # LLM requested only already-loaded or non-existent types
                messages.append({
                    "role": "user",
                    "content": (
                        "All types you requested are already loaded or not available. "
                        "Signal readiness or request different types."
                    ),
                })
                continue

            fetched_parts: list[str] = []
            for type_name in requested:
                remaining_budget = self.max_total_chars - total_chars
                if remaining_budget <= 0:
                    break
                slice_xml = _records_to_xml(
                    records_by_type, type_name,
                    min(self.max_chars_per_type, remaining_budget)
                )
                loaded_parts.append(slice_xml)
                loaded_types.add(type_name)
                total_chars += len(slice_xml)
                files_fetched_in_loop += 1
                fetched_parts.append(f"Loaded {type_name}: {type_summary.get(type_name, {}).get('count', 0)} records")

            await _progress("types_fetched", {
                "round": round_num,
                "types": requested,
                "total_chars": total_chars,
            })

            next_msg = "Loaded:\n" + "\n".join(f"  - {p}" for p in fetched_parts)
            if total_chars >= self.max_total_chars:
                next_msg += f"\n\nCONTEXT BUDGET REACHED ({total_chars:,} chars). Signal readiness now."
            messages.append({"role": "user", "content": next_msg})

        # Step 4: Assemble focused XML
        focused_xml = "\n\n".join(loaded_parts)
        included = list(loaded_types)
        skipped = [t for t in all_types if t not in loaded_types]

        await _progress("done", {
            "used_loop": True,
            "types_included": len(included),
            "types_skipped": len(skipped),
            "total_chars": len(focused_xml),
            "iterations": iterations,
        })

        logger.info(
            "[xml_hydration] Done — %d/%d types, %d chars, %d rounds, %d+%d tokens",
            len(included), len(all_types), len(focused_xml),
            iterations, total_input_tokens, total_output_tokens,
        )

        return XMLHydrationResult(
            focused_xml=focused_xml,
            types_included=included,
            types_available=len(all_types),
            records_included=sum(type_summary.get(t, {}).get("count", 0) for t in included),
            total_records=total_records,
            total_chars=len(focused_xml),
            iterations=iterations,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            used_loop=True,
            skipped_types=skipped,
        )

    def _auto_include(
        self,
        records_by_type: dict[str, list[str]],
        priority_list: list[str],
        budget: int,
    ) -> tuple[list[str], list[str]]:
        """Include record types from priority_list within char budget.

        Returns (xml_parts, included_type_names).
        Falls back to including all available types sorted by count if
        priority_list doesn't cover everything.
        """
        parts: list[str] = []
        included: list[str] = []
        chars_used = 0

        # First: prioritised types
        for type_name in priority_list:
            if type_name not in records_by_type:
                continue
            slice_xml = _records_to_xml(records_by_type, type_name, self.max_chars_per_type)
            if chars_used + len(slice_xml) > budget:
                continue
            parts.append(slice_xml)
            included.append(type_name)
            chars_used += len(slice_xml)

        # Second: remaining types by record count (fill remaining budget)
        remaining = sorted(
            [t for t in records_by_type if t not in included],
            key=lambda t: len(records_by_type[t]),
            reverse=True,
        )
        for type_name in remaining:
            slice_xml = _records_to_xml(records_by_type, type_name, self.max_chars_per_type)
            if chars_used + len(slice_xml) > budget:
                break
            parts.append(slice_xml)
            included.append(type_name)
            chars_used += len(slice_xml)

        return parts, included
