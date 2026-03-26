"""XML Parser Agent — extract text content from ServiceNow update set XML files."""

from __future__ import annotations

import logging
import os
import time
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)


async def parse_update_sets(
    file_paths: list[str],
    on_progress=None,
) -> dict:
    """Parse one or more ServiceNow update set XML files.

    Returns:
        {
            "status": "ok",
            "combined_xml": str,       # all XML content concatenated
            "update_sets": [{"filename": str, "name": str, "records": int}],
            "total_records": int,
            "file_count": int,
            "latency_ms": int,
        }
    """
    t0 = time.time()
    if on_progress:
        await on_progress("xml_parser", "running", {})

    combined_parts: list[str] = []
    update_sets: list[dict] = []
    total_records = 0

    for fpath in file_paths:
        filename = os.path.basename(fpath)
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            combined_parts.append(content)

            # Try to parse and extract metadata
            us_name = filename
            record_count = 0
            try:
                root = ET.fromstring(content)
                # ServiceNow update sets typically have <unload> root with <sys_update_xml> children
                name_el = root.find(".//name")
                if name_el is not None and name_el.text:
                    us_name = name_el.text

                # Count sys_update_xml records
                for tag in ["sys_update_xml", "sys_remote_update_set"]:
                    records = root.findall(f".//{tag}")
                    record_count += len(records)

                # If no specific records found, count all direct children
                if record_count == 0:
                    record_count = len(list(root))
            except ET.ParseError:
                logger.warning("[sn_xml_parser] Could not parse XML structure for %s, using raw content", filename)
                record_count = content.count("<sys_update_xml")

            total_records += record_count
            update_sets.append({
                "filename": filename,
                "name": us_name,
                "records": record_count,
            })

        except Exception as exc:
            logger.error("[sn_xml_parser] Failed to read %s: %s", fpath, exc)
            update_sets.append({
                "filename": filename,
                "name": filename,
                "records": 0,
                "error": str(exc),
            })

    combined_xml = "\n\n".join(combined_parts)

    # Build structured records index for XMLHydrationLoop
    records_by_type, type_summary = _extract_records_by_type(combined_xml)

    latency_ms = int((time.time() - t0) * 1000)

    if on_progress:
        await on_progress("xml_parser", "done", {
            "files": len(file_paths),
            "update_sets": len(update_sets),
            "records": total_records,
            "record_types": len(records_by_type),
            "latency_ms": latency_ms,
        })

    return {
        "status": "ok",
        "combined_xml": combined_xml,
        "update_sets": update_sets,
        "total_records": total_records,
        "file_count": len(file_paths),
        "latency_ms": latency_ms,
        # Structured data for XMLHydrationLoop
        "records_by_type": records_by_type,
        "type_summary": type_summary,
    }


_CONTAINER_TAGS = {"root", "unload", "xml", "document", "records", "response", "sys_remote_update_set"}


def _extract_records_by_type(combined_xml: str) -> tuple[dict[str, list[str]], dict[str, dict]]:
    """Parse XML content into records grouped by element tag name.

    Only captures record-level elements (children of container tags like
    <unload>), not deeply nested field elements like <name> or <sys_id>.

    Returns:
        records_by_type: {tag_name: [xml_string, ...]}
        type_summary:    {tag_name: {"count": int, "names": [str, ...]}}
    """
    records_by_type: dict[str, list[str]] = {}

    try:
        wrapped = f"<root>{combined_xml}</root>"
        root = ET.fromstring(wrapped)
    except ET.ParseError:
        return _extract_records_by_type_regex(combined_xml)

    def _collect(el: ET.Element) -> None:
        """Walk containers recursively; collect direct children as records."""
        for child in el:
            tag = child.tag
            if tag in _CONTAINER_TAGS:
                # recurse into nested containers
                _collect(child)
            else:
                # this is a record — capture its XML string
                try:
                    xml_str = ET.tostring(child, encoding="unicode")
                except Exception:
                    continue
                records_by_type.setdefault(tag, [])
                records_by_type[tag].append(xml_str)

    _collect(root)

    type_summary = _build_type_summary(records_by_type)
    return records_by_type, type_summary


def _extract_records_by_type_regex(combined_xml: str) -> tuple[dict[str, list[str]], dict[str, dict]]:
    """Fallback: extract record type counts using regex when XML is not well-formed."""
    import re
    records_by_type: dict[str, list[str]] = {}
    # Find all top-level tags
    for match in re.finditer(r"<([a-zA-Z_][a-zA-Z0-9_]*)[\s>]", combined_xml):
        tag = match.group(1)
        if tag not in ("unload", "xml", "root"):
            records_by_type.setdefault(tag, [])
            records_by_type[tag].append("")  # placeholder — no content in fallback

    type_summary = _build_type_summary(records_by_type)
    return records_by_type, type_summary


def _build_type_summary(records_by_type: dict[str, list[str]]) -> dict[str, dict]:
    """Build a summary dict showing count and sample names for each record type."""
    summary: dict[str, dict] = {}
    for tag, records in records_by_type.items():
        if not records:
            continue
        names: list[str] = []
        for xml_str in records[:10]:  # sample first 10 for names
            if not xml_str:
                continue
            try:
                el = ET.fromstring(xml_str)
                for name_tag in ("name", "sys_name", "label", "title"):
                    name_el = el.find(name_tag)
                    if name_el is not None and name_el.text and name_el.text.strip():
                        names.append(name_el.text.strip())
                        break
            except Exception:
                pass
        summary[tag] = {"count": len(records), "names": names}
    return summary
