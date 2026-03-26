"""hydration_guard.py — Validation layer for LLM retrieval-loop responses.

Enforces the rule: the LLM MUST request and receive at least one structure
file before it is permitted to produce any application specification.

A "premature build" is defined as:
    - LLM returns a production response (output / ready=true / filesystem_plan)
    - AND no structure files have been fetched yet during the retrieval loop
      (genome.index.json alone does NOT count as sufficient context)

Premature responses are REJECTED and a correction message is injected into
the conversation so the LLM gets another chance to retrieve context.

Usage (in any hydration loop)::

    from services.hydration_guard import Guard

    guard = Guard(min_structure_files=1, max_retries=2)

    result = guard.validate(parsed_response, files_fetched_in_loop=total_files_fetched)
    if result.rejected:
        # inject result.correction_message into conversation and continue
        messages.append({"role": "user", "content": result.correction_message})
        continue  # retry this round

    # response is valid — proceed normally
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Minimum files fetched via the retrieval loop (not counting pre-fetched index)
# before a production response is accepted.
MIN_STRUCTURE_FILES: int = 1

# Maximum number of times a single round may be retried after rejection.
MAX_RETRIES_PER_ROUND: int = 2


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class GuardResult:
    rejected: bool
    reason: str = ""
    correction_message: str = ""


# ---------------------------------------------------------------------------
# Correction messages
# ---------------------------------------------------------------------------

_CORRECTION_NO_FILES = """\
SYSTEM CORRECTION: Your response was rejected.

You attempted to produce output or signal readiness before requesting any files.
This violates the retrieval-first rule.

You MUST:
1. Inspect the entity index you already have
2. Identify which structure files you need
3. Return {"plan": [...], "required_files": ["structure/entities.json", ...]}

Do NOT return "output", "filesystem_plan", or "ready: true" until you have
fetched and read at least one structure file.

Retry now — return a required_files request."""


_CORRECTION_EMPTY_FILES = """\
SYSTEM CORRECTION: Your response was rejected.

You returned an empty required_files list without signalling readiness.
Either request files you need or explicitly signal readiness with a reason.

If you believe you have enough context from the entity index alone, respond with:
{"plan": [...], "ready": true, "reason": "explain why index is sufficient"}

Otherwise, return:
{"plan": [...], "required_files": ["path/to/file.json"]}"""


_CORRECTION_PREMATURE_SPEC = """\
SYSTEM CORRECTION: Your response was rejected.

You generated an application specification (filesystem_plan) without first
retrieving the required genome structure files. This is a premature build.

This causes token regression and hallucinated output. It is a critical failure.

You MUST follow the retrieval loop:
1. Analyze genome.index.json (already provided)
2. Request the specific structure files you need
3. Read their contents
4. Only then produce output

Start over: return {"plan": [...], "required_files": [...]}"""


# ---------------------------------------------------------------------------
# Guard class
# ---------------------------------------------------------------------------

class Guard:
    """Stateful guard that tracks retries per round.

    Create one Guard instance per hydration loop run, not per round.
    Call validate() once per LLM response.
    """

    def __init__(
        self,
        min_structure_files: int = MIN_STRUCTURE_FILES,
        max_retries: int = MAX_RETRIES_PER_ROUND,
    ):
        self.min_structure_files = min_structure_files
        self.max_retries = max_retries
        self._retries: dict[int, int] = {}  # round_num -> retry count

    def validate(
        self,
        parsed: dict,
        files_fetched_in_loop: int,
        round_num: int,
    ) -> GuardResult:
        """Validate a parsed LLM response.

        Args:
            parsed:               The parsed JSON dict from the LLM.
            files_fetched_in_loop: Number of files fetched by the retrieval
                                   loop so far (NOT counting pre-fetched index).
            round_num:            Current round number (1-based).

        Returns:
            GuardResult.rejected == False → response is valid, proceed.
            GuardResult.rejected == True  → inject correction_message and retry.
        """
        retries_this_round = self._retries.get(round_num, 0)

        # --- Detect response shape ---
        has_output = "output" in parsed
        has_filesystem_plan = "filesystem_plan" in parsed  # legacy top-level
        has_ready = bool(parsed.get("ready"))
        required_files = parsed.get("required_files")
        is_empty_request = isinstance(required_files, list) and len(required_files) == 0

        is_production = has_output or has_filesystem_plan
        is_ready = has_ready

        # If we've already retried too many times, accept whatever came back
        if retries_this_round >= self.max_retries:
            logger.warning(
                "[guard] Round %d: max retries (%d) reached — accepting response as-is",
                round_num, self.max_retries,
            )
            return GuardResult(rejected=False, reason="max_retries_exceeded")

        # Rule 1: Premature filesystem_plan — outright spec generation
        if is_production and files_fetched_in_loop < self.min_structure_files:
            self._retries[round_num] = retries_this_round + 1
            logger.warning(
                "[guard] Round %d (retry %d): REJECTED premature filesystem_plan "
                "(files_fetched=%d, min=%d)",
                round_num, self._retries[round_num],
                files_fetched_in_loop, self.min_structure_files,
            )
            return GuardResult(
                rejected=True,
                reason="premature_spec",
                correction_message=_CORRECTION_PREMATURE_SPEC,
            )

        # Rule 2: Ready signal with no files fetched
        if is_ready and files_fetched_in_loop < self.min_structure_files:
            self._retries[round_num] = retries_this_round + 1
            logger.warning(
                "[guard] Round %d (retry %d): REJECTED early ready signal "
                "(files_fetched=%d)",
                round_num, self._retries[round_num], files_fetched_in_loop,
            )
            return GuardResult(
                rejected=True,
                reason="premature_ready",
                correction_message=_CORRECTION_NO_FILES,
            )

        # Rule 3: Empty required_files with nothing loaded yet
        if is_empty_request and not is_ready and files_fetched_in_loop < self.min_structure_files:
            self._retries[round_num] = retries_this_round + 1
            logger.warning(
                "[guard] Round %d (retry %d): REJECTED empty required_files "
                "with no prior fetches",
                round_num, self._retries[round_num],
            )
            return GuardResult(
                rejected=True,
                reason="empty_required_files",
                correction_message=_CORRECTION_EMPTY_FILES,
            )

        return GuardResult(rejected=False)

    def retry_count(self, round_num: int) -> int:
        return self._retries.get(round_num, 0)


# ---------------------------------------------------------------------------
# Convenience: guard-enforced system prompt suffix
# ---------------------------------------------------------------------------

RETRIEVAL_FIRST_RULE = """\
## CRITICAL RULE — RETRIEVAL BEFORE BUILD

You MUST NOT generate a full application specification immediately.
You MUST first:

1. Analyze the entity index (genome.index.json)
2. Identify which structure files contain the information you need
3. Request those files via required_files

Only proceed to produce output AFTER you have fetched and read at least one
structure file from the repository.

If you violate this rule your response WILL BE REJECTED and you will be
asked to retry. Premature builds waste tokens and produce hallucinated output.

This rule is enforced programmatically — there is no way around it."""
