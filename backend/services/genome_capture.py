"""Genome Capture Pipeline — two-pass extraction via vendor self-deploy adapters.

Pass 1 (Scan):   POST /extract → returns genome structure (GenomeDocument + GenomeGraph)
Pass 2 (Expand): POST /expand  → returns full config/data for GitHub commit

GitHub repo structure:
    genomes/tenants/{tenant}/vendors/{vendor}/{application}/
        genome.yaml
        graph.yaml
        structure/
        config/
        data/
"""

from __future__ import annotations

import json
import logging
import time

import httpx
import yaml

from services import servicenow_tools
from services.genome_builder import build_genome_from_extraction
from services.snow_to_github import (
    _load_github_targets,
    _parse_repo_ref,
    _ensure_repo,
    _commit_files_to_repo,
    _scrub_secrets,
)
from adapters.servicenow_catalog_adapter import create_servicenow_extraction

logger = logging.getLogger(__name__)

_SNOW_TIMEOUT = 90


# ---------------------------------------------------------------------------
# Pass 1 — Genome Scan
# ---------------------------------------------------------------------------


async def genome_scan(
    tenant_id: str,
    integration_id: str,
    target_type: str,
    target_name: str,
    depth: str,
    app,
) -> dict:
    """Call the vendor adapter's /extract endpoint and build genome locally.

    Returns {status, genome_document, genome_graph, raw_extraction, summary}.
    """
    # Resolve integration credentials
    integration = await app.state.integration_store.get(integration_id)
    if not integration:
        return {"status": "error", "error": "Integration not found"}

    cfg = await servicenow_tools._get_snow_config(tenant_id, app)
    instance_url = cfg["instance_url"]
    auth_header = cfg["auth_header"]

    # Build the extract endpoint URL
    # Use the self-deploy extractor pattern: POST /api/1939459/overyonder_selfdeploy/extract/{key}
    extractor_key = target_name.lower().replace(" ", "_")
    extract_url = f"{instance_url}/api/1939459/overyonder_selfdeploy/extract/{extractor_key}"

    logger.info("[genome_capture] Scan: POST %s (depth=%s)", extract_url, depth)

    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=_SNOW_TIMEOUT) as client:
            resp = await client.post(
                extract_url,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": auth_header,
                },
                json={
                    "target_type": target_type,
                    "target_name": target_name,
                    "depth": depth,
                },
            )
    except Exception as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        return {"status": "error", "error": f"ServiceNow unreachable ({latency_ms}ms): {exc}"}

    latency_ms = int((time.monotonic() - t0) * 1000)

    if not resp.is_success:
        return {
            "status": "error",
            "error": f"ServiceNow HTTP {resp.status_code}",
            "latency_ms": latency_ms,
        }

    try:
        data = resp.json()
    except Exception:
        return {"status": "error", "error": "Non-JSON response from ServiceNow"}

    # Check for ServiceNow-level errors
    result_data = data.get("result", data)
    if isinstance(result_data, dict) and result_data.get("status") == "error":
        return {
            "status": "error",
            "error": result_data.get("message", "Extraction failed"),
            "latency_ms": latency_ms,
        }

    # Feed into extraction pipeline to build GenomeDocument + GenomeGraph
    try:
        extraction_id = await create_servicenow_extraction(
            tenant_id, target_name, result_data if isinstance(result_data, dict) else data, app,
        )
    except Exception as exc:
        logger.warning("[genome_capture] Extraction pipeline failed (non-blocking): %s", exc)
        extraction_id = None

    # Build genome locally for immediate preview
    raw_result = result_data.get("result", result_data) if isinstance(result_data, dict) else result_data
    genome_result = None
    try:
        # Normalize the extraction payload for the genome builder
        normalized = _normalize_scan_result(raw_result)
        genome_result = build_genome_from_extraction(normalized, "servicenow")
    except Exception as exc:
        logger.warning("[genome_capture] Genome build failed: %s", exc)

    # Build summary
    summary = {}
    if isinstance(raw_result, dict):
        s = raw_result.get("summary", {})
        summary = {
            "items": int(s.get("item_count", 0)),
            "variables": int(s.get("variable_count", 0)),
            "choices": int(s.get("choice_count", 0)),
        }

    return {
        "status": "ok",
        "extraction_id": extraction_id,
        "latency_ms": latency_ms,
        "payload_size": len(resp.text),
        "summary": summary,
        "genome_document": genome_result["genome_document"].model_dump() if genome_result else None,
        "genome_graph": genome_result["genome_graph"].model_dump() if genome_result and genome_result.get("genome_graph") else None,
        "raw_extraction": raw_result,
    }


def _normalize_scan_result(raw: dict) -> dict:
    """Normalize a self-deploy extraction result into the genome builder's expected format."""
    items = raw.get("items", [])
    tables = []
    fields = []
    workflows = []
    relationships = []

    for item in items:
        name = item.get("name", "")
        if name:
            tables.append(name)

        category = item.get("category", "")
        if category and category not in tables:
            tables.append(category)
            relationships.append(f"{category} \u2192 {name}")

        for var in item.get("variables", []):
            var_name = var.get("name", "")
            if var_name and var_name not in fields:
                fields.append(var_name)

        if item.get("variables"):
            relationships.append(f"{name} \u2192 variables")

        wf = item.get("workflow", "")
        if wf:
            workflows.append(f"{name} workflow")

        workflows.append(f"{name} request")

    return {
        "tables": tables,
        "fields": fields,
        "workflows": workflows,
        "relationships": relationships,
    }


# ---------------------------------------------------------------------------
# Pass 2 — Expand & Commit to GitHub
# ---------------------------------------------------------------------------


async def genome_expand_and_commit(
    tenant_id: str,
    integration_id: str,
    target_name: str,
    target_type: str,
    depth: str,
    raw_extraction: dict,
    genome_document: dict | None,
    genome_graph: dict | None,
    app,
) -> dict:
    """Build the GitHub file tree and commit.

    Uses the raw extraction from Pass 1 to build YAML/JSON files in the
    prescribed directory structure.
    """
    # Resolve GitHub target (auto-select first available)
    targets = await _load_github_targets(tenant_id, app)
    if not targets:
        return {"status": "error", "error": "No GitHub integration configured"}

    target = targets[0]
    if not target.token:
        return {"status": "error", "error": "GitHub integration has no access token"}

    owner, repo_name = _parse_repo_ref(target.default_repo, target.org)
    if not owner:
        return {"status": "error", "error": "GitHub integration missing org/owner"}

    headers = {
        "Authorization": f"Bearer {target.token}",
        "Accept": "application/vnd.github+json",
    }

    # Resolve integration for vendor name
    integration = await app.state.integration_store.get(integration_id)
    vendor = integration.integration_type if integration else "unknown"

    # Build file tree
    app_slug = target_name.lower().replace(" ", "_").replace("/", "_")
    base = f"genomes/tenants/{tenant_id}/vendors/{vendor}/{app_slug}"

    files: dict[str, str] = {}

    # genome.yaml — the flat GenomeDocument
    if genome_document:
        files[f"{base}/genome.yaml"] = yaml.dump(genome_document, default_flow_style=False, sort_keys=False)

    # graph.yaml — the structured GenomeGraph
    if genome_graph:
        files[f"{base}/graph.yaml"] = yaml.dump(genome_graph, default_flow_style=False, sort_keys=False)

    # structure/ — catalog items as individual YAML files
    items = raw_extraction.get("items", []) if isinstance(raw_extraction, dict) else []
    for item in items:
        item_name = item.get("name", "unknown")
        item_slug = item_name.lower().replace(" ", "_").replace("(", "").replace(")", "")
        structure_data = {
            "name": item_name,
            "category": item.get("category", ""),
            "description": item.get("short_description", item.get("description", "")),
            "active": item.get("active", True),
            "variables": [
                {
                    "name": v.get("name", ""),
                    "type": v.get("type", ""),
                    "mandatory": v.get("mandatory", False),
                    "question": v.get("question_text", ""),
                }
                for v in item.get("variables", [])
                if v.get("name")
            ],
        }
        files[f"{base}/structure/{item_slug}.yaml"] = yaml.dump(
            structure_data, default_flow_style=False, sort_keys=False,
        )

    # config/ — pricing and workflow config
    config_items = []
    for item in items:
        cfg = {"name": item.get("name", "")}
        if item.get("price"):
            cfg["price"] = item["price"]
        if item.get("recurring_price"):
            cfg["recurring_price"] = item["recurring_price"]
        if item.get("workflow"):
            cfg["workflow"] = item["workflow"]
        config_items.append(cfg)
    if config_items:
        files[f"{base}/config/catalog_config.yaml"] = yaml.dump(
            config_items, default_flow_style=False, sort_keys=False,
        )

    # data/ — raw extraction JSON
    if raw_extraction:
        files[f"{base}/data/raw_extraction.json"] = json.dumps(raw_extraction, indent=2)

    # Scrub secrets from all files
    files = {path: _scrub_secrets(content) for path, content in files.items()}

    # Ensure repo and commit
    repo = await _ensure_repo(owner, repo_name, headers, description=f"Genome: {target_name}")
    if not repo["ok"]:
        return {"status": "error", "error": repo["error"]}

    commit_msg = (
        f"Capture genome\n\n"
        f"Tenant: {tenant_id}\n"
        f"Vendor: {vendor}\n"
        f"Application: {target_name}\n"
        f"Depth: {depth}"
    )

    # Override the default commit message for this pipeline
    import services.snow_to_github as _gh
    original_msg = _gh.COMMIT_MESSAGE
    _gh.COMMIT_MESSAGE = commit_msg

    result = await _commit_files_to_repo(owner, repo_name, files, headers)

    _gh.COMMIT_MESSAGE = original_msg  # restore

    if not result["pushed"]:
        return {"status": "error", "error": "Failed to commit files to GitHub", "errors": result.get("errors", [])}

    logger.info("[genome_capture] Committed %d files to %s/%s", len(result["pushed"]), owner, repo_name)

    return {
        "status": "ok",
        "repo_url": repo["repo_url"],
        "commit_hash": result["commit_hash"],
        "files_pushed": result["pushed"],
        "file_count": len(result["pushed"]),
    }
