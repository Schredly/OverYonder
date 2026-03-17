"""Application Genomes CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request

from pydantic import BaseModel

from models import ApplicationGenome, CreateGenomeRequest, GenomeArtifact
from services.genome_graph_builder import build_graph_from_document
from services.genome_discovery import discover_genomes, capture_genome_candidate
from services.genome_capture import genome_scan, genome_expand_and_commit

router = APIRouter(prefix="/api/admin/{tenant_id}/genomes", tags=["genomes"])


async def _require_tenant(tenant_id: str, request: Request):
    tenant = await request.app.state.tenant_store.get(tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.get("")
async def list_genomes(tenant_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    return await request.app.state.genome_store.list_for_tenant(tenant_id)


@router.get("/{genome_id}")
async def get_genome(tenant_id: str, genome_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    genome = await request.app.state.genome_store.get(genome_id)
    if genome is None:
        raise HTTPException(status_code=404, detail="Genome not found")

    # Look up the latest artifact for this genome
    artifact = await request.app.state.genome_artifact_store.get_latest_by_genome(genome_id)

    result = genome.model_dump()
    result["artifact"] = artifact.model_dump() if artifact else None
    return result


@router.post("", status_code=201)
async def create_genome(tenant_id: str, body: CreateGenomeRequest, request: Request):
    await _require_tenant(tenant_id, request)
    genome_id = f"genome_{uuid.uuid4().hex[:12]}"
    genome = ApplicationGenome(
        id=genome_id,
        tenant_id=tenant_id,
        **body.model_dump(),
    )
    created = await request.app.state.genome_store.create(genome)

    # Also create an artifact record
    artifact = GenomeArtifact(
        id=f"gart_{uuid.uuid4().hex[:12]}",
        genome_id=genome_id,
        version=1,
        artifact_json=body.genome_document.model_dump(),
    )
    await request.app.state.genome_artifact_store.create(artifact)

    return created


@router.get("/{genome_id}/graph")
async def get_genome_graph(tenant_id: str, genome_id: str, request: Request):
    """Temporary debug endpoint — return the GenomeGraph for a genome.

    If the genome already has a stored graph, return it directly.
    Otherwise, generate one on the fly from the GenomeDocument.
    """
    await _require_tenant(tenant_id, request)
    genome = await request.app.state.genome_store.get(genome_id)
    if genome is None:
        raise HTTPException(status_code=404, detail="Genome not found")

    graph = genome.genome_graph
    if graph is None:
        graph = build_graph_from_document(genome.genome_document)

    return {"status": "success", "graph": graph.model_dump()}


@router.get("/discover/candidates")
async def discover_genome_candidates(tenant_id: str, request: Request):
    """Scan enabled integrations and return discoverable genome candidates."""
    await _require_tenant(tenant_id, request)
    results = await discover_genomes(tenant_id, request.app)
    return results


class CaptureGenomeRequest(BaseModel):
    candidate_id: str
    candidate_name: str
    candidate_type: str = "catalog"


@router.post("/discover/capture")
async def capture_genome(tenant_id: str, body: CaptureGenomeRequest, request: Request):
    """Capture a discovered genome candidate — fetch, extract, and persist."""
    await _require_tenant(tenant_id, request)
    result = await capture_genome_candidate(
        tenant_id=tenant_id,
        candidate_id=body.candidate_id,
        candidate_name=body.candidate_name,
        candidate_type=body.candidate_type,
        app=request.app,
    )
    return result


class GenomeScanRequest(BaseModel):
    integration_id: str
    target_type: str = "service_catalog"
    target_name: str
    depth: str = "structure"


@router.post("/capture/scan")
async def scan_genome(tenant_id: str, body: GenomeScanRequest, request: Request):
    """Pass 1 — Call vendor adapter to extract genome structure."""
    await _require_tenant(tenant_id, request)
    return await genome_scan(
        tenant_id=tenant_id,
        integration_id=body.integration_id,
        target_type=body.target_type,
        target_name=body.target_name,
        depth=body.depth,
        app=request.app,
    )


class GenomeExpandRequest(BaseModel):
    integration_id: str
    target_name: str
    target_type: str = "service_catalog"
    depth: str = "structure"
    raw_extraction: dict = {}
    genome_document: dict | None = None
    genome_graph: dict | None = None


@router.post("/capture/expand")
async def expand_and_commit_genome(tenant_id: str, body: GenomeExpandRequest, request: Request):
    """Pass 2 — Expand and commit genome files to GitHub."""
    await _require_tenant(tenant_id, request)
    return await genome_expand_and_commit(
        tenant_id=tenant_id,
        integration_id=body.integration_id,
        target_name=body.target_name,
        target_type=body.target_type,
        depth=body.depth,
        raw_extraction=body.raw_extraction,
        genome_document=body.genome_document,
        genome_graph=body.genome_graph,
        app=request.app,
    )


@router.delete("/{genome_id}", status_code=204)
async def delete_genome(tenant_id: str, genome_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    deleted = await request.app.state.genome_store.delete(genome_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Genome not found")
