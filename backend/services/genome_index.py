"""genome_index.py — Deterministic genome.index.json generator.

Builds a lightweight, structured index for every committed genome.
No LLM calls — pure rule-based extraction from the genome dict.

Output schema:
  {
    "entities": {
      "forms":         [{"id", "name", "file_path"}],
      "workflows":     [{"id", "name", "file_path"}],
      "tables":        [{"id", "name", "file_path"}],
      "ui_components": [{"id", "name", "file_path"}]
    },
    "relationships": {"<entity_id>": ["<related_entity_id>", ...]},
    "summaries":     {"<entity_id>": "1-2 sentence description."},
    "metadata": {
      "application_name": str,
      "source_system":    str,
      "entity_counts":    {"forms": int, "workflows": int, "tables": int, "ui_components": int}
    }
  }
"""

from __future__ import annotations

import re


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slug(name: str) -> str:
    """Convert a display name to a deterministic, filesystem-safe ID."""
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = s.strip("_")
    return s or "unknown"


def _entity_id(category: str, name: str) -> str:
    """Build a prefixed entity ID, e.g. 'form_rental_request'."""
    prefix = {"forms": "form", "workflows": "wf", "tables": "tbl", "ui_components": "ui"}.get(category, category)
    return f"{prefix}_{_slug(name)}"


def _short_summary(name: str, category: str, description: str = "", count: int = 0, count_label: str = "") -> str:
    """Build a 1–2 sentence deterministic summary."""
    desc = (description or "").strip()
    # Truncate to first sentence if very long
    if desc and len(desc) > 120:
        end = desc.find(".")
        desc = desc[: end + 1] if 0 < end < 120 else desc[:120] + "..."
    parts = []
    if desc:
        parts.append(desc)
    else:
        label = category.rstrip("s").replace("_", " ").capitalize()
        parts.append(f"{label}: {name}.")
    if count and count_label:
        parts.append(f"Contains {count} {count_label}.")
    return " ".join(parts)


def _name_from_entry(entry) -> str:
    """Extract a display name from various entry shapes."""
    if isinstance(entry, dict):
        for key in ("name", "title", "label", "sys_name", "workflow_name", "table_name"):
            v = entry.get(key)
            if v and isinstance(v, str):
                return v.strip()
    if isinstance(entry, str):
        return entry.strip()
    return "unknown"


def _desc_from_entry(entry) -> str:
    if not isinstance(entry, dict):
        return ""
    for key in ("description", "short_description", "summary", "purpose"):
        v = entry.get(key)
        if v and isinstance(v, str):
            return v.strip()
    return ""


def _count_sub(entry, keys: list[str]) -> tuple[int, str]:
    """Return (count, label) for the first matching sub-collection key."""
    if not isinstance(entry, dict):
        return 0, ""
    for key in keys:
        v = entry.get(key)
        if isinstance(v, list) and v:
            return len(v), key
    return 0, ""


# ---------------------------------------------------------------------------
# Entity extraction helpers (per genome source type)
# ---------------------------------------------------------------------------

def _extract_forms(genome: dict, base: str) -> tuple[list[dict], dict, dict]:
    """Returns (entities_list, summaries_dict, relationships_dict)."""
    entities, summaries, rels = [], {}, {}

    # SN: catalog items
    catalog = genome.get("catalog")
    if isinstance(catalog, list):
        for item in catalog:
            name = _name_from_entry(item)
            eid = _entity_id("forms", name)
            cnt, lbl = _count_sub(item, ["variables", "fields", "items"])
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/catalog.json"})
            summaries[eid] = _short_summary(name, "forms", _desc_from_entry(item), cnt, lbl)
        return entities, summaries, rels

    # SN: entities section (may contain form-like objects)
    sn_entities = genome.get("entities")
    if isinstance(sn_entities, list):
        for item in sn_entities:
            name = _name_from_entry(item)
            eid = _entity_id("forms", name)
            cnt, lbl = _count_sub(item, ["fields", "variables"])
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/entities.json"})
            summaries[eid] = _short_summary(name, "forms", _desc_from_entry(item), cnt, lbl)
        return entities, summaries, rels

    # Doc/Video: genome_document.objects
    gd = genome.get("genome_document", {})
    if isinstance(gd, dict):
        for raw in gd.get("objects", []):
            if isinstance(raw, str):
                # Try JSON-decode strings stored as stringified JSON
                try:
                    import json as _json
                    item = _json.loads(raw)
                except Exception:
                    item = {"name": raw}
            else:
                item = raw
            name = _name_from_entry(item)
            eid = _entity_id("forms", name)
            cnt, lbl = _count_sub(item, ["fields", "variables"])
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/objects.json"})
            summaries[eid] = _short_summary(name, "forms", _desc_from_entry(item), cnt, lbl)

    return entities, summaries, rels


def _extract_workflows(genome: dict, base: str) -> tuple[list[dict], dict, dict]:
    entities, summaries, rels = [], {}, {}

    raw_wfs = genome.get("workflows")

    # Fallback: genome_document.workflows
    if not raw_wfs:
        gd = genome.get("genome_document", {})
        raw_wfs = gd.get("workflows") if isinstance(gd, dict) else None

    if not isinstance(raw_wfs, list):
        return entities, summaries, rels

    for wf in raw_wfs:
        if isinstance(wf, str):
            try:
                import json as _json
                wf = _json.loads(wf)
            except Exception:
                wf = {"name": wf}
        name = _name_from_entry(wf)
        eid = _entity_id("workflows", name)
        cnt, lbl = _count_sub(wf, ["steps", "activities", "stages", "tasks"])
        entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/workflows.json"})
        summaries[eid] = _short_summary(name, "workflows", _desc_from_entry(wf), cnt, lbl or "steps")

        # Relationships: workflow → referenced forms/tables
        for ref_key in ("triggers_on", "uses_table", "related_to", "form"):
            ref = wf.get(ref_key)
            if ref and isinstance(ref, str):
                ref_id = _entity_id("forms", ref) if "form" in ref_key else _entity_id("tables", ref)
                rels.setdefault(eid, [])
                if ref_id not in rels[eid]:
                    rels[eid].append(ref_id)

    return entities, summaries, rels


def _extract_tables(genome: dict, base: str) -> tuple[list[dict], dict, dict]:
    entities, summaries, rels = [], {}, {}

    # SN: data_model
    dm = genome.get("data_model")
    if isinstance(dm, list):
        for tbl in dm:
            name = _name_from_entry(tbl)
            eid = _entity_id("tables", name)
            cnt, lbl = _count_sub(tbl, ["fields", "columns"])
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/data_model.json"})
            summaries[eid] = _short_summary(name, "tables", _desc_from_entry(tbl), cnt, lbl or "fields")
        return entities, summaries, rels

    # Doc/Video: genome_document relationships reference tables
    # We won't duplicate objects already in forms; skip if no data_model present

    return entities, summaries, rels


def _extract_ui_components(genome: dict, base: str) -> tuple[list[dict], dict, dict]:
    entities, summaries, rels = [], {}, {}

    ui = genome.get("ui")
    if isinstance(ui, list):
        for comp in ui:
            name = _name_from_entry(comp)
            eid = _entity_id("ui_components", name)
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/ui.json"})
            summaries[eid] = _short_summary(name, "ui_components", _desc_from_entry(comp))
    elif isinstance(ui, dict):
        # ui may be a dict with "components" list
        for comp in ui.get("components", []):
            name = _name_from_entry(comp)
            eid = _entity_id("ui_components", name)
            entities.append({"id": eid, "name": name, "file_path": f"{base}/structure/ui.json"})
            summaries[eid] = _short_summary(name, "ui_components", _desc_from_entry(comp))

    return entities, summaries, rels


def _extract_relationships_from_genome(genome: dict, existing_rels: dict) -> dict:
    """Pull any explicit relationship data from genome_document.relationships."""
    rels = dict(existing_rels)
    gd = genome.get("genome_document", {})
    if not isinstance(gd, dict):
        return rels

    raw_rels = gd.get("relationships", [])
    for entry in raw_rels:
        if isinstance(entry, str):
            try:
                import json as _json
                entry = _json.loads(entry)
            except Exception:
                continue
        if not isinstance(entry, dict):
            continue
        src_name = entry.get("from") or entry.get("source") or entry.get("name", "")
        tgt_name = entry.get("to") or entry.get("target", "")
        if src_name and tgt_name:
            # Use generic entity IDs without category prefix for cross-references
            src_id = _slug(src_name)
            tgt_id = _slug(tgt_name)
            rels.setdefault(src_id, [])
            if tgt_id not in rels[src_id]:
                rels[src_id].append(tgt_id)

    return rels


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_genome_index(
    genome: dict,
    base_path: str,
    application_name: str,
    vendor: str,
) -> dict:
    """Build a deterministic genome.index.json from an extracted genome dict.

    Args:
        genome:           The normalized genome dict (from extraction pipeline).
        base_path:        GitHub base path for this genome, e.g.
                          "genomes/tenants/acme/vendors/servicenow/beach_bum/rentals".
        application_name: Human-readable application name.
        vendor:           Source vendor/platform name.

    Returns:
        A dict ready for json.dumps() — the genome.index.json content.
    """
    entities: dict[str, list] = {"forms": [], "workflows": [], "tables": [], "ui_components": []}
    all_summaries: dict = {}
    all_rels: dict = {}

    # --- Forms / objects ---
    form_ents, form_sums, form_rels = _extract_forms(genome, base_path)
    entities["forms"] = form_ents
    all_summaries.update(form_sums)
    all_rels.update(form_rels)

    # --- Workflows ---
    wf_ents, wf_sums, wf_rels = _extract_workflows(genome, base_path)
    entities["workflows"] = wf_ents
    all_summaries.update(wf_sums)
    for k, v in wf_rels.items():
        all_rels.setdefault(k, [])
        for item in v:
            if item not in all_rels[k]:
                all_rels[k].append(item)

    # --- Tables ---
    tbl_ents, tbl_sums, tbl_rels = _extract_tables(genome, base_path)
    entities["tables"] = tbl_ents
    all_summaries.update(tbl_sums)
    all_rels.update(tbl_rels)

    # --- UI components ---
    ui_ents, ui_sums, _ = _extract_ui_components(genome, base_path)
    entities["ui_components"] = ui_ents
    all_summaries.update(ui_sums)

    # --- Relationships from genome_document ---
    all_rels = _extract_relationships_from_genome(genome, all_rels)

    # --- Metadata ---
    total_forms = len(entities["forms"])
    total_wfs = len(entities["workflows"])
    total_tbls = len(entities["tables"])
    total_ui = len(entities["ui_components"])

    # Application-level summary if nothing else
    if not all_summaries and application_name:
        all_summaries["app"] = f"{application_name} genome captured from {vendor}."

    return {
        "entities": entities,
        "relationships": all_rels,
        "summaries": all_summaries,
        "metadata": {
            "application_name": application_name,
            "source_system": vendor,
            "entity_counts": {
                "forms": total_forms,
                "workflows": total_wfs,
                "tables": total_tbls,
                "ui_components": total_ui,
            },
        },
    }
