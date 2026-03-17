"""Genome Discovery — discover extractable applications from configured integrations.

Queries enabled integrations for their known application inventory (catalogs,
workflows, tables) and returns structured GenomeCandidate lists for the UI.
"""

from __future__ import annotations

import json
import logging
import time

from pydantic import BaseModel, Field

from services import servicenow_tools
from services.snow_to_replit import _fetch_catalog
from adapters.servicenow_catalog_adapter import create_servicenow_extraction
from services.snow_to_github import (
    _load_github_targets,
    _resolve_target,
    _parse_repo_ref,
    _ensure_repo,
    _commit_files_to_repo,
    _scrub_secrets,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class GenomeCandidate(BaseModel):
    """A discoverable application that can be captured as a genome."""

    id: str                          # Unique key (e.g. "snow_catalog_Technical Catalog")
    name: str                        # Display name
    type: str                        # "catalog", "workflow", "table"
    integration_id: str              # FK → Integration.id
    integration_type: str            # "servicenow", "salesforce", etc.
    instance_url: str = ""           # e.g. "dev221705.service-now.com"
    endpoint_name: str = ""          # Which endpoint to call for full extraction
    metadata: dict = Field(default_factory=dict)


class DiscoveryResult(BaseModel):
    """Result of a discovery scan for a single integration."""

    integration_id: str
    integration_type: str
    integration_name: str
    instance_url: str
    enabled: bool
    candidates: list[GenomeCandidate] = Field(default_factory=list)
    error: str = ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def discover_genomes(tenant_id: str, app) -> list[DiscoveryResult]:
    """Scan all enabled integrations for the tenant and return genome candidates."""
    integrations = await app.state.integration_store.list_for_tenant(tenant_id)
    results: list[DiscoveryResult] = []

    for integ in integrations:
        if not integ.enabled:
            continue

        if integ.integration_type == "servicenow":
            result = await _discover_servicenow(tenant_id, integ, app)
            results.append(result)
        # Future: elif integ.integration_type == "salesforce": ...

    return results


async def capture_genome_candidate(
    tenant_id: str,
    candidate_id: str,
    candidate_name: str,
    candidate_type: str,
    app,
) -> dict:
    """Capture a discovered genome candidate — fetch full data, build document + graph, persist.

    Returns the created genome or an error dict.
    """
    # Resolve the ServiceNow integration
    cfg = await servicenow_tools._get_snow_config(tenant_id, app)

    # Determine which endpoint to call based on candidate type
    if candidate_type == "catalog":
        encoded_name = candidate_name.replace(" ", "%20")
        service_url = await servicenow_tools.get_endpoint_url(
            tenant_id, "Catalog By Title", app, catalogTitle=encoded_name,
        )
        if not service_url:
            return {"status": "error", "error": "No 'Catalog By Title' endpoint configured."}
    else:
        return {"status": "error", "error": f"Capture for type '{candidate_type}' is not yet supported."}

    # Fetch the full payload
    t0 = time.monotonic()
    try:
        resp = await _fetch_catalog(service_url, cfg["auth_header"])
    except Exception as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        return {
            "status": "error",
            "error": f"ServiceNow unreachable ({latency_ms}ms) — {exc}",
        }
    latency_ms = int((time.monotonic() - t0) * 1000)

    if not resp.is_success:
        return {"status": "error", "error": f"ServiceNow HTTP {resp.status_code}"}

    try:
        catalog_json = resp.json()
    except Exception:
        return {"status": "error", "error": "Non-JSON response from ServiceNow"}

    # Feed into the genome extraction pipeline (creates extraction → worker builds genome)
    try:
        extraction_id = await create_servicenow_extraction(
            tenant_id, candidate_name, catalog_json, app,
        )
    except Exception as exc:
        return {"status": "error", "error": f"Extraction failed: {exc}"}

    # Commit genome files to the tenant's GitHub integration
    github_result = await _commit_genome_to_github(
        tenant_id, candidate_name, catalog_json, app,
    )

    result = {
        "status": "ok",
        "message": f"Genome capture initiated for \"{candidate_name}\"",
        "extraction_id": extraction_id,
        "candidate_name": candidate_name,
        "candidate_type": candidate_type,
        "latency_ms": latency_ms,
        "payload_size": len(resp.text),
    }

    if github_result:
        result["github"] = github_result

    return result


# ---------------------------------------------------------------------------
# ServiceNow discovery
# ---------------------------------------------------------------------------


async def _discover_servicenow(tenant_id: str, integration, app) -> DiscoveryResult:
    """Query ServiceNow for discoverable genomes (catalogs)."""
    instance_url = (integration.config or {}).get("instance_url", "")
    display_url = instance_url.replace("https://", "").replace("http://", "").rstrip("/")

    result = DiscoveryResult(
        integration_id=integration.id,
        integration_type="servicenow",
        integration_name=integration.config.get("name", "") or "ServiceNow",
        instance_url=display_url,
        enabled=True,
    )

    try:
        cfg = await servicenow_tools._get_snow_config(tenant_id, app)
    except RuntimeError as exc:
        result.error = str(exc)
        return result

    candidates: list[GenomeCandidate] = []

    # --- Discover catalogs via "List Catalogs" endpoint ---
    catalog_url = await servicenow_tools.get_endpoint_url(tenant_id, "List Catalogs", app)
    if catalog_url:
        try:
            resp = await _fetch_catalog(catalog_url, cfg["auth_header"])
            if resp.is_success:
                data = resp.json()
                names = _parse_names(data)
                for name in names:
                    candidates.append(GenomeCandidate(
                        id=f"snow_catalog_{name}",
                        name=name,
                        type="catalog",
                        integration_id=integration.id,
                        integration_type="servicenow",
                        instance_url=display_url,
                        endpoint_name="Catalog By Title",
                    ))
                logger.info("[genome_discovery] ServiceNow catalogs: %s", names)
        except Exception as exc:
            logger.warning("[genome_discovery] Failed to list catalogs: %s", exc)

    result.candidates = candidates
    return result


def _parse_names(data: dict | list) -> list[str]:
    """Extract names from a ServiceNow list response (reuse logic from snow_to_github)."""
    from services.snow_to_github import _parse_catalog_names
    return _parse_catalog_names(data)


# ---------------------------------------------------------------------------
# GitHub genome commit
# ---------------------------------------------------------------------------

GENOME_COMMIT_MESSAGE = "genome: captured from ServiceNow"


def _build_genome_files(candidate_name: str, catalog_json: dict) -> dict[str, str]:
    """Build the single-folder genome file set for GitHub commit.

    Structure:
        {folder}/genome.json   — the raw catalog payload
        {folder}/prompt.md     — a summary header

    All content is scrubbed for secrets before returning.
    """
    folder = candidate_name.lower().replace(" ", "-").replace("/", "-")
    payload_str = json.dumps(catalog_json, indent=2)

    prompt = (
        f"# {candidate_name}\n\n"
        f"Genome captured from ServiceNow by OverYonder.ai.\n\n"
        f"This file contains the raw catalog payload for the "
        f"\"{candidate_name}\" application.\n\n"
        f"Use this data to rebuild, migrate, or analyze the application."
    )

    files = {
        f"{folder}/prompt.md": prompt,
        f"{folder}/genome.json": payload_str,
    }
    return {path: _scrub_secrets(content) for path, content in files.items()}


async def _commit_genome_to_github(
    tenant_id: str,
    candidate_name: str,
    catalog_json: dict,
    app,
) -> dict | None:
    """Auto-commit genome files to the tenant's GitHub integration.

    Auto-selects the first available GitHub integration. If none is configured,
    returns None (non-blocking — genome is still captured locally).
    """
    targets = await _load_github_targets(tenant_id, app)
    if not targets:
        logger.info("[genome_discovery] No GitHub integration configured — skipping commit")
        return None

    target = targets[0]  # Auto-select first available
    if not target.token:
        logger.warning("[genome_discovery] GitHub integration has no token — skipping commit")
        return None

    owner, repo_name = _parse_repo_ref(target.default_repo, target.org)
    if not owner:
        logger.warning("[genome_discovery] GitHub integration missing org/owner — skipping commit")
        return None

    headers = {
        "Authorization": f"Bearer {target.token}",
        "Accept": "application/vnd.github+json",
    }

    # Ensure repo exists
    repo = await _ensure_repo(owner, repo_name, headers, description=f"Genome: {candidate_name}")
    if not repo["ok"]:
        logger.error("[genome_discovery] Failed to ensure repo: %s", repo.get("error"))
        return {"status": "error", "error": repo["error"]}

    # Build files and commit
    files = _build_genome_files(candidate_name, catalog_json)
    print(f"[genome_discovery] Committing {len(files)} file(s) to {owner}/{repo_name}")

    result = await _commit_files_to_repo(owner, repo_name, files, headers)

    if not result["pushed"]:
        return {"status": "error", "error": "Failed to commit genome files to GitHub"}

    print(f"[genome_discovery] Committed {len(result['pushed'])} file(s), hash: {result['commit_hash'][:12]}")

    return {
        "status": "ok",
        "repo_url": repo["repo_url"],
        "commit_hash": result["commit_hash"],
        "files_pushed": result["pushed"],
    }
