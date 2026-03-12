"""ServiceNow Catalog Adapter — normalize raw ServiceNow catalog extraction output
into the standard extraction payload format consumed by genome_builder's ServiceNow parser.

Input:  Raw ServiceNow catalog JSON (various shapes from catalog APIs)
Output: { "tables": [], "fields": [], "workflows": [], "relationships": [] }
"""

from __future__ import annotations

import logging
import re
import uuid

from models import ExtractionPayload
from workers.genome_worker import notify_genome_worker

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def normalize_servicenow_catalog(payload: dict) -> dict:
    """Convert raw ServiceNow catalog JSON into the standard extraction format.

    Handles these common ServiceNow catalog API shapes:
      1. {result: {catalog_title, items: [{item: {name, variables, categories, ...}}]}}
      2. {result: [{name, label, columns, ...}]}
      3. {items: [...]}
      4. Flat list of item dicts

    Returns:
        {
            "tables": [],         # catalog items treated as objects/entities
            "fields": [],         # variables/fields from catalog items
            "workflows": [],      # request flows, approval chains
            "relationships": [],  # item → variable group, category → item links
        }
    """
    items = _extract_items(payload)
    if not items:
        logger.warning("[snow_catalog_adapter] No catalog items found in payload")
        return {"tables": [], "fields": [], "workflows": [], "relationships": []}

    tables: list[str] = []
    fields: list[str] = []
    workflows: list[str] = []
    relationships: list[str] = []

    seen_tables: set[str] = set()
    seen_fields: set[str] = set()
    seen_workflows: set[str] = set()
    seen_rels: set[str] = set()

    for item in items:
        item_name = _get_item_name(item)
        if not item_name:
            continue

        # --- Tables: each catalog item is an entity ---
        if item_name not in seen_tables:
            tables.append(item_name)
            seen_tables.add(item_name)

        # --- Fields: from variables ---
        variables = item.get("variables", [])
        for var in variables:
            var_name = _get_variable_name(var)
            if var_name and var_name not in seen_fields:
                fields.append(var_name)
                seen_fields.add(var_name)

        # --- Workflows: derive from item structure ---
        # Each catalog item implies a request submission workflow
        wf_name = f"{item_name} request"
        if wf_name not in seen_workflows:
            workflows.append(wf_name)
            seen_workflows.add(wf_name)

        # If the item has approval-related indicators, add an approval workflow
        if _has_approval(item):
            approval_wf = f"{item_name} approval"
            if approval_wf not in seen_workflows:
                workflows.append(approval_wf)
                seen_workflows.add(approval_wf)

        # --- Relationships: item → category, item → variable group ---
        categories = item.get("categories", [])
        for cat in categories:
            cat_name = cat if isinstance(cat, str) else cat.get("name", str(cat))
            cat_name = cat_name.strip()
            if cat_name:
                # Add category as a table if not already
                if cat_name not in seen_tables:
                    tables.append(cat_name)
                    seen_tables.add(cat_name)
                rel = f"{cat_name} → {item_name}"
                if rel not in seen_rels:
                    relationships.append(rel)
                    seen_rels.add(rel)

        # Link variables to the item if there are many
        if len(variables) > 0:
            rel = f"{item_name} → variables"
            if rel not in seen_rels:
                relationships.append(rel)
                seen_rels.add(rel)

    result = {
        "tables": tables,
        "fields": fields,
        "workflows": workflows,
        "relationships": relationships,
    }

    logger.info(
        "[snow_catalog_adapter] Normalized: %d tables, %d fields, %d workflows, %d relationships",
        len(tables), len(fields), len(workflows), len(relationships),
    )
    return result


async def create_servicenow_extraction(
    tenant_id: str,
    catalog_name: str,
    payload: dict,
    app,
) -> str:
    """Normalize a ServiceNow catalog payload and create an extraction record.

    Returns the extraction_id. The genome worker will pick it up automatically.
    """
    normalized = normalize_servicenow_catalog(payload)

    extraction = ExtractionPayload(
        id=f"ext_{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        vendor="ServiceNow",
        source_platform="ServiceNow",
        application_name=catalog_name,
        payload=normalized,
        status="pending",
    )
    created = await app.state.extraction_store.create(extraction)

    logger.info(
        "[snow_catalog_adapter] Created extraction %s for catalog '%s' (tenant=%s)",
        created.id, catalog_name, tenant_id,
    )

    # Wake the genome worker immediately instead of waiting for the next poll
    notify_genome_worker()

    return created.id


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_items(payload: dict) -> list[dict]:
    """Pull the list of catalog item dicts from various ServiceNow API shapes."""
    # Shape 1: {result: {catalog_title, items: [...]}}
    result = payload.get("result", {})
    if isinstance(result, dict) and "items" in result:
        raw_items = result["items"]
        # Items may be wrapped: [{item: {...}, prompts: ...}]
        return [
            entry.get("item", entry) if isinstance(entry, dict) else entry
            for entry in raw_items
        ]

    # Shape 2: {result: [{name, label, ...}]}
    if isinstance(result, list):
        return result

    # Shape 3: {items: [...]}
    if "items" in payload:
        raw_items = payload["items"]
        return [
            entry.get("item", entry) if isinstance(entry, dict) else entry
            for entry in raw_items
        ]

    # Shape 4: payload is a list
    if isinstance(payload, list):
        return payload

    # Shape 5: single item dict with "name"
    if "name" in payload:
        return [payload]

    return []


def _get_item_name(item: dict) -> str:
    """Extract a clean name from a catalog item dict."""
    name = item.get("name") or item.get("label") or item.get("title") or ""
    return _strip_html(name).strip()


def _get_variable_name(var: dict) -> str:
    """Extract a variable name, preferring 'name' then 'question'."""
    name = var.get("name") or var.get("question") or var.get("label") or ""
    name = _strip_html(name).strip()
    # Normalize: replace spaces with underscores, lowercase
    if name:
        name = re.sub(r"\s+", "_", name).lower()
    return name


def _has_approval(item: dict) -> bool:
    """Check if a catalog item indicates an approval workflow."""
    # Check for approval-related fields in variables
    for var in item.get("variables", []):
        var_name = (var.get("name") or var.get("question") or "").lower()
        if any(kw in var_name for kw in ("approv", "manager", "authorize")):
            return True

    # Check item name/description for approval hints
    name = (item.get("name") or "").lower()
    desc = (item.get("description") or "").lower()
    approval_keywords = ("approval", "authorize", "sign-off", "signoff")
    return any(kw in name or kw in desc for kw in approval_keywords)


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string, decode common entities."""
    import html as html_mod
    return html_mod.unescape(re.sub(r"<[^>]+>", "", text)).strip()
