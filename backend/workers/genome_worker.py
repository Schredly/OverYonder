"""Genome Worker — async background loop that processes pending extraction payloads.

Flow:
  1. Query extraction_payloads where status = "pending"
  2. Compute SHA-256 payload hash; skip duplicates of previously processed payloads
  3. Set status = "processing"
  4. Run genome_builder.build_genome_from_extraction(payload)
  5. Insert new ApplicationGenome + GenomeArtifact into stores
  6. Mark extraction status = "completed" with genome_id
  On error: status = "failed" with error_message

Processes pending extractions in parallel batches via asyncio.gather.
Poll interval is configurable via GENOME_WORKER_INTERVAL_SECONDS env var (default 30).
Call notify_genome_worker() to wake the worker immediately instead of waiting.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import traceback
import uuid
from datetime import date, datetime, timezone

from models import ApplicationGenome, GenomeArtifact
from services.genome_builder import build_genome_from_extraction

logger = logging.getLogger(__name__)

GENOME_WORKER_INTERVAL_SECONDS = int(
    os.environ.get("GENOME_WORKER_INTERVAL_SECONDS", "30")
)

BATCH_CONCURRENCY = int(
    os.environ.get("GENOME_WORKER_BATCH_CONCURRENCY", "5")
)

# Event used to wake the worker immediately when a new extraction is created.
_wake_event: asyncio.Event | None = None


def notify_genome_worker() -> None:
    """Signal the worker to wake up and process pending extractions immediately."""
    if _wake_event is not None:
        _wake_event.set()


def _compute_payload_hash(payload: dict) -> str:
    """Compute a deterministic SHA-256 hash of a payload dict."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


async def _process_one(extraction, app) -> None:
    """Process a single pending extraction payload."""
    ext_id = extraction.id

    # Compute payload hash for dedup
    payload_hash = _compute_payload_hash(extraction.payload)

    # Check for duplicate — skip if an identical payload was already processed
    existing = await app.state.extraction_store.find_by_payload_hash(payload_hash)
    if existing is not None:
        await app.state.extraction_store.update(
            ext_id,
            status="completed",
            payload_hash=payload_hash,
            genome_id=existing.genome_id,
            error_message="deduplicated: identical payload already processed",
        )
        logger.info("[genome_worker] Deduplicated %s → existing %s",
                    ext_id, existing.genome_id)
        return

    # Mark as processing and store hash
    await app.state.extraction_store.update(
        ext_id, status="processing", payload_hash=payload_hash,
    )
    logger.info("[genome_worker] Processing extraction %s (%s / %s)",
                ext_id, extraction.vendor, extraction.application_name)

    try:
        # Build genome document
        result = build_genome_from_extraction(extraction.payload, extraction.vendor)
        genome_doc = result["genome_document"]
        object_count = result["object_count"]
        workflow_count = result["workflow_count"]

        # Create ApplicationGenome record
        genome_id = f"genome_{uuid.uuid4().hex[:12]}"
        genome = ApplicationGenome(
            id=genome_id,
            tenant_id=extraction.tenant_id,
            vendor=extraction.vendor,
            application_name=extraction.application_name,
            source_platform=extraction.source_platform,
            target_platform="",
            category="",
            object_count=object_count,
            workflow_count=workflow_count,
            captured_date=date.today().isoformat(),
            genome_document=genome_doc,
            source_signature=ext_id,
        )
        await app.state.genome_store.create(genome)

        # Create GenomeArtifact record
        artifact = GenomeArtifact(
            id=f"gart_{uuid.uuid4().hex[:12]}",
            genome_id=genome_id,
            version=1,
            artifact_json=genome_doc.model_dump(),
        )
        await app.state.genome_artifact_store.create(artifact)

        # Mark extraction as completed
        await app.state.extraction_store.update(
            ext_id,
            status="completed",
            genome_id=genome_id,
        )
        logger.info("[genome_worker] Completed %s → genome %s (%d objects, %d workflows)",
                     ext_id, genome_id, object_count, workflow_count)

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        await app.state.extraction_store.update(
            ext_id,
            status="failed",
            error_message=error_msg,
        )
        logger.error("[genome_worker] Failed %s: %s", ext_id, exc)


async def _poll_once(app) -> int:
    """Run one poll cycle. Returns count of extractions processed."""
    pending = await app.state.extraction_store.list_by_status("pending")
    if not pending:
        return 0

    logger.info("[genome_worker] Found %d pending extraction(s)", len(pending))

    # Process in batches of BATCH_CONCURRENCY
    for i in range(0, len(pending), BATCH_CONCURRENCY):
        batch = pending[i : i + BATCH_CONCURRENCY]
        await asyncio.gather(
            *[_process_one(extraction, app) for extraction in batch],
            return_exceptions=True,
        )

    return len(pending)


async def genome_worker_loop(app) -> None:
    """Background loop — wakes on notify or every GENOME_WORKER_INTERVAL_SECONDS."""
    global _wake_event
    _wake_event = asyncio.Event()

    logger.info("[genome_worker] Started (interval=%ds, concurrency=%d)",
                GENOME_WORKER_INTERVAL_SECONDS, BATCH_CONCURRENCY)
    while True:
        try:
            await _poll_once(app)
        except Exception as exc:
            logger.error("[genome_worker] Unexpected error in poll loop: %s", exc)

        # Wait for either a wake signal or the timeout — whichever comes first
        _wake_event.clear()
        try:
            await asyncio.wait_for(_wake_event.wait(), timeout=GENOME_WORKER_INTERVAL_SECONDS)
            logger.info("[genome_worker] Woke up via notify signal")
        except asyncio.TimeoutError:
            pass  # Normal poll interval elapsed


def start_genome_worker(app) -> asyncio.Task:
    """Launch the genome worker as a background asyncio task."""
    task = asyncio.create_task(genome_worker_loop(app))
    logger.info("[genome_worker] Background task created")
    return task
