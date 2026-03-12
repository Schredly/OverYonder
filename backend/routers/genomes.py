"""Application Genomes CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request

from models import ApplicationGenome, CreateGenomeRequest, GenomeArtifact

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


@router.delete("/{genome_id}", status_code=204)
async def delete_genome(tenant_id: str, genome_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    deleted = await request.app.state.genome_store.delete(genome_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Genome not found")
