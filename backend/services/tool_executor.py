"""Central tool executor — dispatches tool calls to integration-specific implementations."""

from __future__ import annotations

import logging

from models import TOOL_CATALOG_BY_ID
from services import servicenow_tools, google_drive_tools, replit_tools

logger = logging.getLogger(__name__)

async def _genome_hydrate_context(tenant_id: str, input_payload: dict, app) -> dict:
    """Tool handler: run ContextHydrationSkill for a genome path.

    input_payload keys:
        genome_path  (str, required)  — GitHub base path for the genome
        user_request (str, required)  — The transformation/build intent
        extra_system (str, optional)  — Additional LLM instructions (e.g. recipe)

    Returns a JSON-serialisable summary of the HydrationContext.
    The full HydrationContext object is attached under the "hydration_context" key
    so the next skill in the chain can consume it directly.
    """
    genome_path = input_payload.get("genome_path", "")
    user_request = input_payload.get("user_request", "")
    extra_system = input_payload.get("extra_system", "")

    if not genome_path or not user_request:
        return {"status": "error", "error": "genome_path and user_request are required"}

    try:
        from services.snow_to_replit import _get_llm_config
        llm_cfg = await _get_llm_config(tenant_id, app)
    except Exception as exc:
        return {"status": "error", "error": f"LLM not configured: {exc}"}

    from services.context_hydration_skill import ContextHydrationSkill
    skill = ContextHydrationSkill()
    ctx = await skill.run(
        genome_path=genome_path,
        user_request=user_request,
        llm_cfg=llm_cfg,
        app=app,
        extra_system=extra_system,
    )

    return {
        "status": "ok",
        "ready": ctx.ready,
        "ready_reason": ctx.ready_reason,
        "files_loaded": len(ctx.loaded_files),
        "total_chars": ctx.total_chars,
        "total_input_tokens": ctx.total_input_tokens,
        "total_output_tokens": ctx.total_output_tokens,
        "iterations": len(ctx.iterations),
        "accumulated_plan": ctx.accumulated_plan,
        # Full context object — consumed by downstream skills
        "hydration_context": ctx,
    }


# Map: (integration_type, action) -> handler function
# genome.hydrate_context is defined above to avoid forward-reference issues
_HANDLERS: dict[str, callable] = {
    "servicenow.search_incidents": servicenow_tools.search_incidents,
    "servicenow.get_incident_details": servicenow_tools.get_incident_details,
    "servicenow.search_kb": servicenow_tools.search_kb,
    "servicenow.add_work_note": servicenow_tools.add_work_note,
    "google-drive.search_documents": google_drive_tools.search_documents,
    "google-drive.read_file": google_drive_tools.read_file,
    "google-drive.create_file": google_drive_tools.create_file,
    "replit.build_application": replit_tools.build_application,
    "genome.hydrate_context": _genome_hydrate_context,
}


async def execute_tool(
    tenant_id: str,
    tool_id: str,
    input_payload: dict,
    app,
) -> dict:
    """Execute a tool by its catalog ID.

    Returns the tool response dict.  For unimplemented tools returns
    {"status": "not_implemented", "tool_id": tool_id}.
    """
    # Validate tool exists in catalog
    if tool_id not in TOOL_CATALOG_BY_ID:
        logger.warning("Unknown tool_id: %s", tool_id)
        return {"status": "not_implemented", "tool_id": tool_id}

    handler = _HANDLERS.get(tool_id)
    if handler is None:
        return {"status": "not_implemented", "tool_id": tool_id}

    try:
        result = await handler(tenant_id, input_payload, app)
        return result
    except RuntimeError as e:
        # Config not found — return error rather than crash
        logger.error("Tool %s config error: %s", tool_id, e)
        return {"status": "error", "tool_id": tool_id, "error": str(e)}
    except Exception as e:
        logger.exception("Tool %s unexpected error", tool_id)
        return {"status": "error", "tool_id": tool_id, "error": str(e)}
