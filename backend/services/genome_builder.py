"""Genome Builder — deterministic conversion of raw extraction payloads into structured genome documents.

Accepts a raw extraction payload dict and vendor string, returns a GenomeDocument
with objects, workflows, fields, relationships, plus computed counts.

No AI/LLM calls — pure deterministic parsing.
"""

from __future__ import annotations

from models import GenomeDocument


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_genome_from_extraction(payload: dict, vendor: str) -> dict:
    """Convert a raw extraction payload into a genome document + counts.

    Returns:
        {
            "genome_document": GenomeDocument,
            "object_count": int,
            "workflow_count": int,
        }
    """
    vendor_lower = vendor.lower().strip()
    parser = _VENDOR_PARSERS.get(vendor_lower, _parse_generic)
    result = parser(payload)

    doc = GenomeDocument(
        objects=result["objects"],
        workflows=result["workflows"],
        fields=result["fields"],
        relationships=result["relationships"],
    )

    return {
        "genome_document": doc,
        "object_count": len(doc.objects),
        "workflow_count": len(doc.workflows),
    }


# ---------------------------------------------------------------------------
# Vendor-specific parsers
# ---------------------------------------------------------------------------


def _parse_servicenow(payload: dict) -> dict:
    """Parse ServiceNow extraction payload.

    Expected payload shapes:
        { "tables": [...], "workflows": [...], "fields": {...}, "references": [...] }
    or:
        { "result": [{ "name", "label", "columns": [...], ... }] }
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # --- Objects: from "tables" list or "result" records ---
    if "tables" in payload:
        for t in payload["tables"]:
            if isinstance(t, str):
                objects.append(t)
            elif isinstance(t, dict):
                objects.append(t.get("name") or t.get("label") or str(t))
    elif "result" in payload and isinstance(payload["result"], list):
        for record in payload["result"]:
            if isinstance(record, dict):
                name = record.get("name") or record.get("label") or record.get("sys_name", "")
                if name:
                    objects.append(name)
                # Extract fields from columns
                for col in record.get("columns", []):
                    col_name = col if isinstance(col, str) else col.get("name", "")
                    if col_name and col_name not in fields:
                        fields.append(col_name)

    # --- Workflows: from "workflows", "flows", or "business_rules" ---
    for key in ("workflows", "flows", "business_rules", "flow_definitions"):
        for wf in payload.get(key, []):
            if isinstance(wf, str):
                workflows.append(wf)
            elif isinstance(wf, dict):
                workflows.append(wf.get("name") or wf.get("label") or str(wf))

    # --- Fields: from "fields" dict/list or "columns" ---
    if "fields" in payload and not fields:
        raw_fields = payload["fields"]
        if isinstance(raw_fields, dict):
            # { table_name: [field1, field2, ...] }
            for table_fields in raw_fields.values():
                if isinstance(table_fields, list):
                    for f in table_fields:
                        fname = f if isinstance(f, str) else f.get("name", "")
                        if fname and fname not in fields:
                            fields.append(fname)
        elif isinstance(raw_fields, list):
            for f in raw_fields:
                fname = f if isinstance(f, str) else f.get("name", "")
                if fname and fname not in fields:
                    fields.append(fname)

    # --- Relationships: from "references" or "relationships" ---
    for key in ("references", "relationships", "reference_fields"):
        for ref in payload.get(key, []):
            if isinstance(ref, str):
                # Already in "A → B" format or "A -> B"
                relationships.append(ref.replace(" -> ", " → "))
            elif isinstance(ref, dict):
                src = ref.get("source") or ref.get("from") or ref.get("table", "")
                tgt = ref.get("target") or ref.get("to") or ref.get("reference", "")
                if src and tgt:
                    relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


def _parse_salesforce(payload: dict) -> dict:
    """Parse Salesforce extraction payload.

    Expected payload shapes:
        { "sobjects": [...], "flows": [...], "fields": {...}, "lookups": [...] }
    or:
        { "metadata": { "objects": [...], ... } }
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # --- Objects: from "sobjects", "objects", or metadata ---
    for key in ("sobjects", "objects", "custom_objects"):
        for obj in payload.get(key, []):
            if isinstance(obj, str):
                objects.append(obj)
            elif isinstance(obj, dict):
                objects.append(obj.get("name") or obj.get("label") or str(obj))

    if "metadata" in payload and isinstance(payload["metadata"], dict):
        for obj in payload["metadata"].get("objects", []):
            name = obj if isinstance(obj, str) else obj.get("name", "")
            if name and name not in objects:
                objects.append(name)

    # --- Workflows: from "flows", "process_builders", "workflows", "apex_triggers" ---
    for key in ("flows", "process_builders", "workflows", "apex_triggers", "automations"):
        for wf in payload.get(key, []):
            if isinstance(wf, str):
                workflows.append(wf)
            elif isinstance(wf, dict):
                workflows.append(wf.get("name") or wf.get("label") or str(wf))

    # --- Fields ---
    if "fields" in payload:
        raw_fields = payload["fields"]
        if isinstance(raw_fields, dict):
            for obj_fields in raw_fields.values():
                if isinstance(obj_fields, list):
                    for f in obj_fields:
                        fname = f if isinstance(f, str) else f.get("name", "")
                        if fname and fname not in fields:
                            fields.append(fname)
        elif isinstance(raw_fields, list):
            for f in raw_fields:
                fname = f if isinstance(f, str) else f.get("name", "")
                if fname and fname not in fields:
                    fields.append(fname)

    # --- Relationships: from "lookups", "master_details", "relationships" ---
    for key in ("lookups", "master_details", "relationships"):
        for ref in payload.get(key, []):
            if isinstance(ref, str):
                relationships.append(ref.replace(" -> ", " → "))
            elif isinstance(ref, dict):
                src = ref.get("source") or ref.get("from") or ref.get("child_object", "")
                tgt = ref.get("target") or ref.get("to") or ref.get("parent_object", "")
                if src and tgt:
                    relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


def _parse_jira(payload: dict) -> dict:
    """Parse Jira extraction payload.

    Expected payload shapes:
        { "projects": [...], "issue_types": [...], "workflows": [...], "fields": [...] }
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # --- Objects: projects, issue_types, boards, sprints ---
    for key in ("projects", "issue_types", "boards", "sprints", "components"):
        for obj in payload.get(key, []):
            if isinstance(obj, str):
                objects.append(obj)
            elif isinstance(obj, dict):
                objects.append(obj.get("name") or obj.get("key") or str(obj))

    # --- Workflows: from "workflows", "automations" ---
    for key in ("workflows", "automations", "rules"):
        for wf in payload.get(key, []):
            if isinstance(wf, str):
                workflows.append(wf)
            elif isinstance(wf, dict):
                workflows.append(wf.get("name") or wf.get("label") or str(wf))

    # --- Fields ---
    for f in payload.get("fields", []):
        if isinstance(f, str):
            fields.append(f)
        elif isinstance(f, dict):
            fname = f.get("name") or f.get("id", "")
            if fname:
                fields.append(fname)

    # --- Relationships: from "links", "relationships" ---
    for key in ("links", "relationships"):
        for ref in payload.get(key, []):
            if isinstance(ref, str):
                relationships.append(ref.replace(" -> ", " → "))
            elif isinstance(ref, dict):
                src = ref.get("source") or ref.get("from") or ref.get("inward", "")
                tgt = ref.get("target") or ref.get("to") or ref.get("outward", "")
                if src and tgt:
                    relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


def _parse_zendesk(payload: dict) -> dict:
    """Parse Zendesk extraction payload.

    Expected payload shapes:
        { "ticket_forms": [...], "triggers": [...], "macros": [...], "fields": [...] }
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # --- Objects: ticket_forms, groups, organizations ---
    for key in ("ticket_forms", "groups", "organizations", "brands", "objects"):
        for obj in payload.get(key, []):
            if isinstance(obj, str):
                objects.append(obj)
            elif isinstance(obj, dict):
                objects.append(obj.get("name") or obj.get("title") or str(obj))

    # --- Workflows: triggers, automations, macros ---
    for key in ("triggers", "automations", "macros", "workflows"):
        for wf in payload.get(key, []):
            if isinstance(wf, str):
                workflows.append(wf)
            elif isinstance(wf, dict):
                workflows.append(wf.get("title") or wf.get("name") or str(wf))

    # --- Fields: ticket_fields, user_fields ---
    for key in ("ticket_fields", "user_fields", "fields"):
        for f in payload.get(key, []):
            if isinstance(f, str):
                fields.append(f)
            elif isinstance(f, dict):
                fname = f.get("title") or f.get("name") or f.get("key", "")
                if fname:
                    fields.append(fname)

    # --- Relationships ---
    for ref in payload.get("relationships", []):
        if isinstance(ref, str):
            relationships.append(ref.replace(" -> ", " → "))
        elif isinstance(ref, dict):
            src = ref.get("source") or ref.get("from", "")
            tgt = ref.get("target") or ref.get("to", "")
            if src and tgt:
                relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


def _parse_workday(payload: dict) -> dict:
    """Parse Workday extraction payload.

    Expected payload shapes:
        { "business_objects": [...], "business_processes": [...], "fields": [...] }
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # --- Objects: business_objects, report_definitions, domains ---
    for key in ("business_objects", "report_definitions", "domains", "objects"):
        for obj in payload.get(key, []):
            if isinstance(obj, str):
                objects.append(obj)
            elif isinstance(obj, dict):
                objects.append(obj.get("name") or obj.get("label") or str(obj))

    # --- Workflows: business_processes, integrations ---
    for key in ("business_processes", "integrations", "workflows", "tasks"):
        for wf in payload.get(key, []):
            if isinstance(wf, str):
                workflows.append(wf)
            elif isinstance(wf, dict):
                workflows.append(wf.get("name") or wf.get("label") or str(wf))

    # --- Fields ---
    for f in payload.get("fields", []):
        if isinstance(f, str):
            fields.append(f)
        elif isinstance(f, dict):
            fname = f.get("name") or f.get("label", "")
            if fname:
                fields.append(fname)

    # --- Relationships ---
    for ref in payload.get("relationships", []):
        if isinstance(ref, str):
            relationships.append(ref.replace(" -> ", " → "))
        elif isinstance(ref, dict):
            src = ref.get("source") or ref.get("from", "")
            tgt = ref.get("target") or ref.get("to", "")
            if src and tgt:
                relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


def _parse_generic(payload: dict) -> dict:
    """Fallback parser for unknown vendors.

    Scans common key names and extracts what it can.
    """
    objects: list[str] = []
    workflows: list[str] = []
    fields: list[str] = []
    relationships: list[str] = []

    # Object-like keys
    for key in ("tables", "objects", "entities", "sobjects", "business_objects",
                "projects", "ticket_forms", "groups", "result"):
        for item in payload.get(key, []):
            if isinstance(item, str):
                objects.append(item)
            elif isinstance(item, dict):
                objects.append(
                    item.get("name") or item.get("label") or item.get("key") or str(item)
                )

    # Workflow-like keys
    for key in ("workflows", "flows", "automations", "triggers", "business_rules",
                "business_processes", "macros", "rules"):
        for item in payload.get(key, []):
            if isinstance(item, str):
                workflows.append(item)
            elif isinstance(item, dict):
                workflows.append(
                    item.get("name") or item.get("title") or item.get("label") or str(item)
                )

    # Field-like keys
    for key in ("fields", "columns", "ticket_fields", "user_fields"):
        raw = payload.get(key, [])
        if isinstance(raw, dict):
            for vals in raw.values():
                if isinstance(vals, list):
                    for f in vals:
                        fname = f if isinstance(f, str) else (f.get("name", "") if isinstance(f, dict) else "")
                        if fname:
                            fields.append(fname)
        elif isinstance(raw, list):
            for f in raw:
                if isinstance(f, str):
                    fields.append(f)
                elif isinstance(f, dict):
                    fname = f.get("name") or f.get("title") or f.get("label") or f.get("key", "")
                    if fname:
                        fields.append(fname)

    # Relationship-like keys
    for key in ("relationships", "references", "lookups", "links", "reference_fields"):
        for ref in payload.get(key, []):
            if isinstance(ref, str):
                relationships.append(ref.replace(" -> ", " → "))
            elif isinstance(ref, dict):
                src = ref.get("source") or ref.get("from") or ref.get("table", "")
                tgt = ref.get("target") or ref.get("to") or ref.get("reference", "")
                if src and tgt:
                    relationships.append(f"{src} → {tgt}")

    return {
        "objects": _dedupe(objects),
        "workflows": _dedupe(workflows),
        "fields": _dedupe(fields),
        "relationships": _dedupe(relationships),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _dedupe(items: list[str]) -> list[str]:
    """Remove duplicates while preserving order."""
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        item = item.strip()
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


# ---------------------------------------------------------------------------
# Vendor parser registry
# ---------------------------------------------------------------------------

_VENDOR_PARSERS: dict[str, callable] = {
    "servicenow": _parse_servicenow,
    "salesforce": _parse_salesforce,
    "jira": _parse_jira,
    "zendesk": _parse_zendesk,
    "workday": _parse_workday,
}
