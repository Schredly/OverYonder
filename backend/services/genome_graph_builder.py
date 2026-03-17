"""Convert a flat GenomeDocument into a structured GenomeGraph.

Pure deterministic function — no database access, no LLM usage.
Preserves insertion order from the source document.
"""

from __future__ import annotations

import re

from models import GenomeDocument
from genome_graph import (
    GenomeField,
    GenomeGraph,
    GenomeObject,
    GenomeRelationship,
    GenomeWorkflow,
)

# Both arrow styles used in relationship strings
_ARROW_RE = re.compile(r"\s*(?:→|->)\s*")


def _normalize_id(name: str) -> str:
    """Turn a human-readable name into a stable, slug-style ID.

    "Hardware Request" → "hardware_request"
    "request_item"     → "request_item"
    """
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def build_graph_from_document(genome_document: GenomeDocument) -> GenomeGraph:
    """Convert a flat GenomeDocument into a structured GenomeGraph.

    Mapping rules
    -------------
    objects   → GenomeObject (one per string)
    fields    → GenomeField attached to the best-matching object, or "global"
    relationships → GenomeRelationship with source/target parsed from arrow notation
    workflows → GenomeWorkflow (one per string)

    Relationship and workflow IDs are attached back to the participating
    GenomeObjects so the graph can be traversed from either direction.
    """

    # ------------------------------------------------------------------
    # 1. Objects
    # ------------------------------------------------------------------
    object_ids: dict[str, str] = {}          # normalized_id → original name
    object_by_id: dict[str, GenomeObject] = {}

    for name in genome_document.objects:
        nid = _normalize_id(name)
        if nid in object_by_id:
            continue  # dedupe
        obj = GenomeObject(id=nid, name=name)
        object_by_id[nid] = obj
        object_ids[nid] = name

    # Build a lookup: lowercase name / id → normalized id (for field matching)
    _name_to_id: dict[str, str] = {}
    for nid, name in object_ids.items():
        _name_to_id[name.lower()] = nid
        _name_to_id[nid] = nid
        # Also index individual words for fuzzy prefix matching later
        for word in name.lower().split():
            _name_to_id.setdefault(word, nid)

    # ------------------------------------------------------------------
    # 2. Fields → attach to objects when possible
    # ------------------------------------------------------------------
    fields_by_object: dict[str, list[GenomeField]] = {nid: [] for nid in object_by_id}
    fields_by_object["global"] = []

    for field_name in genome_document.fields:
        owner_id = _match_field_to_object(field_name, _name_to_id)
        fid = _normalize_id(field_name)
        field = GenomeField(
            id=fid,
            name=field_name,
            object_name=object_ids.get(owner_id, "global"),
        )
        fields_by_object.setdefault(owner_id, []).append(field)

    # Attach fields to their objects
    for nid, obj in object_by_id.items():
        obj.fields = fields_by_object.get(nid, [])

    # ------------------------------------------------------------------
    # 3. Relationships
    # ------------------------------------------------------------------
    relationships: list[GenomeRelationship] = []
    rel_index = 0

    for raw in genome_document.relationships:
        parts = _ARROW_RE.split(raw, maxsplit=1)
        if len(parts) == 2:
            source_name, target_name = parts[0].strip(), parts[1].strip()
        else:
            # No arrow found — skip malformed entries
            continue

        source_id = _normalize_id(source_name)
        target_id = _normalize_id(target_name)
        rel_id = f"rel_{rel_index}"
        rel_index += 1

        rel = GenomeRelationship(
            id=rel_id,
            source_object=source_name,
            target_object=target_name,
            relationship_type="reference",
        )
        relationships.append(rel)

        # Attach relationship ID to participating objects
        if source_id in object_by_id:
            object_by_id[source_id].relationships.append(rel_id)
        if target_id in object_by_id and target_id != source_id:
            object_by_id[target_id].relationships.append(rel_id)

    # ------------------------------------------------------------------
    # 4. Workflows
    # ------------------------------------------------------------------
    workflows: list[GenomeWorkflow] = []

    for wf_name in genome_document.workflows:
        wf_id = _normalize_id(wf_name)
        wf = GenomeWorkflow(id=wf_id, name=wf_name)
        workflows.append(wf)

        # Attach workflow ID to any object whose name appears in the
        # workflow name (e.g. "request submission" → object "request")
        wf_lower = wf_name.lower()
        for nid, name in object_ids.items():
            if name.lower() in wf_lower or nid in wf_lower:
                object_by_id[nid].workflows.append(wf_id)

    # ------------------------------------------------------------------
    # 5. Handle global fields (not matched to any object)
    # ------------------------------------------------------------------
    global_fields = fields_by_object.get("global", [])
    if global_fields:
        # Create a synthetic "global" object to hold unmatched fields
        global_obj = object_by_id.get("global")
        if global_obj is None:
            global_obj = GenomeObject(id="global", name="global", type="virtual")
            object_by_id["global"] = global_obj
        global_obj.fields = global_fields

    # ------------------------------------------------------------------
    # 6. Assemble and return
    # ------------------------------------------------------------------
    # Preserve insertion order: original objects first, then global if it exists
    ordered_objects: list[GenomeObject] = []
    for nid in object_ids:
        ordered_objects.append(object_by_id[nid])
    if "global" in object_by_id and "global" not in object_ids:
        ordered_objects.append(object_by_id["global"])

    return GenomeGraph(
        objects=ordered_objects,
        workflows=workflows,
        relationships=relationships,
    )


def _match_field_to_object(
    field_name: str,
    name_to_id: dict[str, str],
) -> str:
    """Try to match a field name to an object.

    Heuristics (in priority order):
    1. Exact prefix match: "request_id" → object "request"
    2. Underscore-delimited prefix: "assigned_to" with object "assigned" (if exists)
    3. Fall back to "global"
    """
    fn_lower = field_name.lower().replace(" ", "_")

    # Try progressively shorter prefixes of the field name
    parts = fn_lower.split("_")
    for length in range(len(parts), 0, -1):
        prefix = "_".join(parts[:length])
        if prefix in name_to_id:
            return name_to_id[prefix]

    return "global"
