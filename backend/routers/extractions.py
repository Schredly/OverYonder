"""Extraction Payloads — store raw platform data before genome generation."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request

from models import CreateExtractionRequest, ExtractionPayload

router = APIRouter(prefix="/api/admin/{tenant_id}/extractions", tags=["extractions"])


async def _require_tenant(tenant_id: str, request: Request):
    tenant = await request.app.state.tenant_store.get(tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.get("")
async def list_extractions(tenant_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    return await request.app.state.extraction_store.list_for_tenant(tenant_id)


@router.get("/{extraction_id}")
async def get_extraction(tenant_id: str, extraction_id: str, request: Request):
    await _require_tenant(tenant_id, request)
    extraction = await request.app.state.extraction_store.get(extraction_id)
    if extraction is None:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return extraction


@router.post("", status_code=201)
async def create_extraction(tenant_id: str, body: CreateExtractionRequest, request: Request):
    await _require_tenant(tenant_id, request)
    extraction = ExtractionPayload(
        id=f"ext_{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        vendor=body.vendor,
        source_platform=body.source_platform,
        application_name=body.application_name,
        payload=body.payload,
        status="pending",
    )
    created = await request.app.state.extraction_store.create(extraction)
    return {"extraction_id": created.id}
