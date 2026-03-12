#!/usr/bin/env python3
"""Generate the OverYonder.ai platform overview PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os

# ── Colors ──────────────────────────────────────────────────────────────────
PRIMARY    = HexColor("#e88c1a")   # OverYonder orange/gold
ACCENT     = HexColor("#f5a623")
DARK_TEXT   = HexColor("#1e293b")
MED_TEXT    = HexColor("#475569")
LIGHT_TEXT  = HexColor("#64748b")
WHITE      = HexColor("#ffffff")
ROW_ALT    = HexColor("#fef9f0")   # warm light orange tint
SECTION_BG = HexColor("#fef3e2")   # warm callout bg
CALLOUT_BD = HexColor("#f5d5a0")

OUT = os.path.join(os.path.dirname(__file__), "OverYonder-Platform-Overview.pdf")


def build_styles():
    ss = getSampleStyleSheet()

    ss.add(ParagraphStyle(
        "CoverTitle", parent=ss["Title"],
        fontSize=32, leading=40, textColor=PRIMARY,
        spaceAfter=6, fontName="Helvetica-Bold", alignment=TA_LEFT,
    ))
    ss.add(ParagraphStyle(
        "CoverSub", parent=ss["Normal"],
        fontSize=14, leading=20, textColor=MED_TEXT,
        spaceAfter=4, fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "CoverTagline", parent=ss["Normal"],
        fontSize=11, leading=16, textColor=LIGHT_TEXT,
        spaceAfter=24, fontName="Helvetica-Oblique",
    ))
    ss.add(ParagraphStyle(
        "SectionTitle", parent=ss["Heading1"],
        fontSize=20, leading=26, textColor=PRIMARY,
        spaceBefore=28, spaceAfter=10, fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "SubSection", parent=ss["Heading2"],
        fontSize=14, leading=19, textColor=DARK_TEXT,
        spaceBefore=16, spaceAfter=6, fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "BodyText2", parent=ss["Normal"],
        fontSize=10.5, leading=16, textColor=MED_TEXT,
        spaceAfter=8, fontName="Helvetica", alignment=TA_JUSTIFY,
    ))
    ss.add(ParagraphStyle(
        "BulletItem", parent=ss["Normal"],
        fontSize=10.5, leading=16, textColor=MED_TEXT,
        leftIndent=22, bulletIndent=10, spaceAfter=4,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "SmallMuted", parent=ss["Normal"],
        fontSize=9, leading=13, textColor=LIGHT_TEXT,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "TableHeader", parent=ss["Normal"],
        fontSize=9.5, leading=13, textColor=WHITE,
        fontName="Helvetica-Bold", alignment=TA_LEFT,
    ))
    ss.add(ParagraphStyle(
        "TableCell", parent=ss["Normal"],
        fontSize=9.5, leading=14, textColor=MED_TEXT,
        fontName="Helvetica",
    ))
    ss.add(ParagraphStyle(
        "TableCellBold", parent=ss["Normal"],
        fontSize=9.5, leading=14, textColor=DARK_TEXT,
        fontName="Helvetica-Bold",
    ))
    ss.add(ParagraphStyle(
        "CalloutText", parent=ss["Normal"],
        fontSize=10.5, leading=16, textColor=HexColor("#7c4a03"),
        fontName="Helvetica", alignment=TA_LEFT,
    ))
    ss.add(ParagraphStyle(
        "FooterText", parent=ss["Normal"],
        fontSize=8, leading=11, textColor=LIGHT_TEXT,
        fontName="Helvetica", alignment=TA_CENTER,
    ))
    return ss


def divider():
    return HRFlowable(width="100%", thickness=1, color=HexColor("#e2e8f0"),
                      spaceBefore=8, spaceAfter=8)


def callout_box(text, ss):
    tbl = Table(
        [[Paragraph(text, ss["CalloutText"])]],
        colWidths=[6.3 * inch],
    )
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SECTION_BG),
        ("BOX", (0, 0), (-1, -1), 1, CALLOUT_BD),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    return tbl


def styled_table(headers, rows, col_widths=None):
    hdr = [Paragraph(h, ParagraphStyle("_h", fontSize=9.5, leading=13,
                                        textColor=WHITE, fontName="Helvetica-Bold"))
           for h in headers]
    data = [hdr]
    for row in rows:
        data.append([
            Paragraph(str(c), ParagraphStyle("_c", fontSize=9.5, leading=14,
                                              textColor=MED_TEXT, fontName="Helvetica"))
            for c in row
        ])

    if col_widths is None:
        col_widths = [6.5 * inch / len(headers)] * len(headers)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


def bullet(text, ss, bold_prefix=None):
    if bold_prefix:
        return Paragraph(
            f"\u2022  <b>{bold_prefix}</b> \u2014 {text}", ss["BulletItem"]
        )
    return Paragraph(f"\u2022  {text}", ss["BulletItem"])


def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(LIGHT_TEXT)
    canvas.drawString(inch, 0.5 * inch, "OverYonder.ai \u2014 Agentic Enterprise Application Portability")
    canvas.drawRightString(7.5 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    ss = build_styles()
    doc = SimpleDocTemplate(
        OUT, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.85 * inch,
        leftMargin=inch, rightMargin=inch,
    )

    story = []

    # ═══════════════════════════════════════════════════════════════════════
    #  COVER PAGE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 1.6 * inch))
    story.append(Paragraph("OverYonder.ai", ss["CoverTitle"]))
    story.append(Paragraph("Agentic Enterprise Application Portability", ss["CoverSub"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Extract, analyze, and modernize enterprise applications using AI-powered agents \u2014 "
        "from legacy ServiceNow catalogs to modern React web apps in minutes.",
        ss["CoverTagline"],
    ))
    story.append(Spacer(1, 12))
    story.append(divider())
    story.append(Spacer(1, 12))

    stats = [
        ["7+", "30+", "9", "5"],
        ["Integrations", "API Endpoints", "Action Types", "Vendor Parsers"],
    ]
    stat_tbl = Table(stats, colWidths=[1.6 * inch] * 4)
    stat_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 22),
        ("TEXTCOLOR", (0, 0), (-1, 0), PRIMARY),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("TEXTCOLOR", (0, 1), (-1, 1), LIGHT_TEXT),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(stat_tbl)
    story.append(Spacer(1, 1.2 * inch))

    story.append(callout_box(
        "<b>Platform at a Glance:</b>  OverYonder.ai is a multi-tenant, agentic intelligence "
        "platform that extracts application definitions from legacy enterprise systems, "
        "generates structured Application Genomes that capture every object, workflow, field, "
        "and relationship, orchestrates AI agents to analyze and transform them, and produces "
        "modern application specifications \u2014 complete with interactive refinement, real-time "
        "execution visibility, and full cost transparency across LLM providers.",
        ss,
    ))

    story.append(Spacer(1, 0.6 * inch))
    story.append(Paragraph(
        "Platform Overview  |  March 2026",
        ss["SmallMuted"],
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("Contents", ss["SectionTitle"]))
    story.append(Spacer(1, 8))
    toc_items = [
        ("1", "Executive Summary"),
        ("2", "Platform Architecture"),
        ("3", "Application Genomes"),
        ("4", "Agent Orchestration Flow"),
        ("5", "ServiceNow Catalog Extraction & Modernization"),
        ("6", "Interactive Prompt Refinement"),
        ("7", "Integrations Ecosystem"),
        ("8", "Control Plane & Administration"),
        ("9", "Actions & Recommendations Engine"),
        ("10", "Agent Conversational UI"),
        ("11", "LLM Cost Tracking & Observability"),
        ("12", "Security & Multi-Tenancy"),
        ("13", "Extensibility & Roadmap"),
    ]
    for num, title in toc_items:
        story.append(Paragraph(
            f"<b>{num}.</b>&nbsp;&nbsp;&nbsp;{title}", ss["BodyText2"]
        ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  1. EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Executive Summary", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "Enterprise organizations depend on legacy platforms like ServiceNow for critical service "
        "management workflows \u2014 service catalogs, incident management, knowledge bases, and "
        "request fulfillment. Modernizing these systems is costly, time-consuming, and risky. "
        "Teams must manually inventory catalog items, map form fields, preserve business logic, "
        "and rebuild everything from scratch in a modern stack.",
        ss["BodyText2"],
    ))
    story.append(Paragraph(
        "<b>OverYonder.ai</b> eliminates this bottleneck by providing an AI-powered portability "
        "layer. The platform connects to enterprise systems, extracts application definitions "
        "(catalogs, forms, workflows), intelligently cleans and restructures the data, and "
        "generates precise specifications for rebuilding them as modern web applications \u2014 "
        "all through a conversational interface with full transparency into every step.",
        ss["BodyText2"],
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Key Value Propositions", ss["SubSection"]))
    story.append(bullet("Extract entire service catalogs from ServiceNow (185+ items, 26+ categories) and transform them into modern React applications in minutes, not months", ss))
    story.append(bullet("<b>Application Genomes</b> capture the complete structural DNA of enterprise applications \u2014 objects, workflows, fields, and relationships \u2014 with deterministic parsing across 5 vendor platforms", ss))
    story.append(bullet("Async genome worker with parallel batch processing, SHA-256 payload deduplication, and instant wake-on-demand processing (51ms vs 30s polling)", ss))
    story.append(bullet("Interactive prompt refinement lets users add capabilities (AI chat, search, item creation) through natural language feedback", ss))
    story.append(bullet("Structure-aware payload optimization reduces 1.28 MB of raw ServiceNow data to 113 KB of clean, human-readable JSON \u2014 a 91.8% reduction", ss))
    story.append(bullet("Full transparency via real-time execution traces, skill-level telemetry, and per-call LLM cost tracking", ss))
    story.append(bullet("Multi-tenant architecture with independent integrations, LLM assignments, and cost guardrails per tenant", ss))
    story.append(bullet("Context-aware action recommendations scored against run context, not static menus", ss))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  2. PLATFORM ARCHITECTURE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Platform Architecture", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "OverYonder.ai follows a modular, event-driven architecture designed for extensibility "
        "and operational clarity. The system comprises three primary layers:",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Frontend \u2014 React Control Plane & Agent UI", ss["SubSection"]))
    story.append(Paragraph(
        "A React 19 single-page application provides two experiences: an <b>Admin Control Plane</b> "
        "for configuring tenants, integrations, skills, use cases, and actions; and an "
        "<b>Agent Conversational UI</b> where end users interact with the AI agent, see live "
        "execution traces, refine application prompts, and approve deployments to Replit.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Backend \u2014 FastAPI Orchestration Engine", ss["SubSection"]))
    story.append(Paragraph(
        "A Python FastAPI service exposes 25+ REST and streaming endpoints. The orchestration "
        "engine chains skills sequentially, emitting Server-Sent Events at each stage for "
        "real-time UI updates. The action execution pipeline handles multi-phase workflows: "
        "input collection \u2192 ServiceNow fetch \u2192 payload cleanup \u2192 LLM draft \u2192 "
        "interactive refinement \u2192 deployment.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Data & Integration Layer", ss["SubSection"]))
    story.append(Paragraph(
        "An abstract store interface pattern (ABC-based) decouples business logic from "
        "persistence. 18+ in-memory stores ship by default; the architecture supports "
        "drop-in PostgreSQL migration. Integration adapters wrap external APIs behind a "
        "uniform tool executor interface with per-tenant credential isolation.",
        ss["BodyText2"],
    ))

    story.append(Spacer(1, 10))

    arch_data = [
        [Paragraph("<b>Layer</b>", ss["TableHeader"]),
         Paragraph("<b>Technology</b>", ss["TableHeader"]),
         Paragraph("<b>Responsibilities</b>", ss["TableHeader"])],
        [Paragraph("Frontend", ss["TableCellBold"]),
         Paragraph("React 19, TypeScript, Tailwind CSS v4, Vite", ss["TableCell"]),
         Paragraph("Admin control plane, agent chat UI, live execution trace, draft refinement, action management", ss["TableCell"])],
        [Paragraph("API Layer", ss["TableCellBold"]),
         Paragraph("FastAPI, Uvicorn, SSE, Pydantic v2", ss["TableCell"]),
         Paragraph("25+ REST endpoints, streaming orchestration, tenant routing, proxy-aware CORS", ss["TableCell"])],
        [Paragraph("Orchestration", ss["TableCellBold"]),
         Paragraph("Python async, background tasks", ss["TableCell"]),
         Paragraph("Skill chain execution, use case selection, tool dispatch, action pipeline, genome worker, event emission", ss["TableCell"])],
        [Paragraph("AI / LLM", ss["TableCellBold"]),
         Paragraph("Anthropic Claude, OpenAI (multi-provider)", ss["TableCell"]),
         Paragraph("Catalog analysis, draft generation, prompt refinement, resolution synthesis, confidence scoring", ss["TableCell"])],
        [Paragraph("Integrations", ss["TableCellBold"]),
         Paragraph("httpx async clients", ss["TableCell"]),
         Paragraph("ServiceNow, Google Drive, Replit, Jira, Slack, GitHub, Salesforce adapters", ss["TableCell"])],
        [Paragraph("Persistence", ss["TableCellBold"]),
         Paragraph("ABC stores (23 in-memory)", ss["TableCell"]),
         Paragraph("Tenants, runs, events, actions, LLM configs, usage tracking, telemetry, integrations, genomes, genome artifacts, extraction payloads", ss["TableCell"])],
    ]
    arch_tbl = Table(arch_data, colWidths=[1.1 * inch, 1.8 * inch, 3.4 * inch])
    arch_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 2), (-1, 2), ROW_ALT),
        ("BACKGROUND", (0, 4), (-1, 4), ROW_ALT),
        ("BACKGROUND", (0, 6), (-1, 6), ROW_ALT),
    ]))
    story.append(arch_tbl)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  3. APPLICATION GENOMES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Application Genomes", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "Application Genomes are the structural DNA of enterprise applications. Each genome "
        "captures the complete blueprint of an application \u2014 its objects, workflows, fields, "
        "and relationships \u2014 providing a portable, vendor-agnostic representation that powers "
        "migration planning, cost analysis, and modern application generation.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Genome Document Structure", ss["SubSection"]))
    story.append(Paragraph(
        "Every genome contains a <b>GenomeDocument</b> with four structural dimensions:",
        ss["BodyText2"],
    ))
    story.append(bullet("Objects \u2014 tables, entities, SObjects, ticket forms, business objects", ss, bold_prefix="Objects"))
    story.append(bullet("Workflows \u2014 business rules, approval flows, automations, triggers, process builders", ss, bold_prefix="Workflows"))
    story.append(bullet("Fields \u2014 columns, variables, attributes, custom fields", ss, bold_prefix="Fields"))
    story.append(bullet("Relationships \u2014 references, lookups, master-detail links, foreign keys", ss, bold_prefix="Relationships"))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Extraction Pipeline", ss["SubSection"]))
    story.append(Paragraph(
        "Raw platform data flows through a three-stage pipeline: extraction, parsing, and persistence.",
        ss["BodyText2"],
    ))

    genome_pipeline = [
        ("Extraction Payload", "Raw JSON from a platform API (ServiceNow catalog, Salesforce metadata, Jira project config) is stored as an ExtractionPayload with status tracking: pending \u2192 processing \u2192 completed | failed."),
        ("Genome Builder", "A deterministic parser (no LLM) converts the raw payload into a structured GenomeDocument. Vendor-specific parsers handle ServiceNow, Salesforce, Jira, Zendesk, and Workday. A generic fallback handles unknown vendors via heuristic key scanning."),
        ("Genome + Artifact", "An ApplicationGenome record is created with metadata (vendor, costs, dates) and a versioned GenomeArtifact stores the parsed document independently \u2014 enabling future multi-version support."),
    ]

    for i, (title, desc) in enumerate(genome_pipeline, 1):
        step_data = [[
            Paragraph(f"<b>{i}</b>", ParagraphStyle("_n", fontSize=14, textColor=PRIMARY,
                                                      fontName="Helvetica-Bold", alignment=TA_CENTER)),
            Paragraph(f"<b>{title}</b><br/><font size=10 color='#475569'>{desc}</font>",
                      ParagraphStyle("_d", fontSize=11, leading=16, textColor=DARK_TEXT,
                                      fontName="Helvetica-Bold")),
        ]]
        step_tbl = Table(step_data, colWidths=[0.5 * inch, 5.8 * inch])
        step_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (1, 0), 10),
        ]))
        story.append(step_tbl)

    story.append(Spacer(1, 8))
    story.append(Paragraph("Vendor Parsers", ss["SubSection"]))

    vendor_tbl = styled_table(
        ["Vendor", "Objects From", "Workflows From", "Relationships From"],
        [
            ["ServiceNow", "tables, result[].name", "workflows, flows, business_rules", "references, relationships"],
            ["Salesforce", "sobjects, custom_objects", "flows, process_builders, apex_triggers", "lookups, master_details"],
            ["Jira", "projects, issue_types, boards", "workflows, automations, rules", "links, relationships"],
            ["Zendesk", "ticket_forms, groups, brands", "triggers, automations, macros", "relationships"],
            ["Workday", "business_objects, domains", "business_processes, integrations", "relationships"],
        ],
        col_widths=[1.1 * inch, 1.7 * inch, 1.9 * inch, 1.6 * inch],
    )
    story.append(vendor_tbl)

    story.append(Spacer(1, 10))
    story.append(Paragraph("Async Genome Worker", ss["SubSection"]))
    story.append(Paragraph(
        "A background asyncio worker processes pending extractions into genomes automatically:",
        ss["BodyText2"],
    ))
    story.append(bullet("Parallel batch processing via asyncio.gather with configurable concurrency (default: 5)", ss))
    story.append(bullet("SHA-256 payload deduplication \u2014 identical payloads reuse the existing genome instead of creating duplicates", ss))
    story.append(bullet("Wake-on-demand via asyncio.Event \u2014 when the ServiceNow-to-Replit action creates an extraction, the worker wakes instantly (51ms) instead of waiting for the next 30-second poll", ss))
    story.append(bullet("Configurable via environment variables: GENOME_WORKER_INTERVAL_SECONDS, GENOME_WORKER_BATCH_CONCURRENCY", ss))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Genome UI", ss["SubSection"]))
    story.append(bullet("Genomes list page with horizontal scroll, cost columns, and created/updated timestamps", ss, bold_prefix="Genomes Page"))
    story.append(bullet("Detail page with Application Overview, Cost Profile, Structural Genome (4-column layout), and collapsible Genome Artifact viewer with copy and download", ss, bold_prefix="Detail Page"))
    story.append(bullet("5-step capture wizard: Source Platform \u2192 Application Type \u2192 Configure \u2192 Preview \u2192 Confirm", ss, bold_prefix="Capture Wizard"))
    story.append(bullet("Analytics dashboard with vendor distribution, workflow complexity, and migration savings", ss, bold_prefix="Insights"))

    story.append(Spacer(1, 10))
    story.append(callout_box(
        "<b>Automatic Genome Creation:</b>  When a user runs the ServiceNow Catalog to Replit "
        "action, the raw catalog data is automatically fed into the genome extraction pipeline. "
        "The genome worker wakes immediately, parses the catalog into a structured genome, and "
        "creates the genome + artifact records \u2014 all within milliseconds, with no manual step required.",
        ss,
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  4. AGENT ORCHESTRATION FLOW
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Agent Orchestration Flow", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "When a user submits a query, the platform executes a deterministic, observable pipeline:",
        ss["BodyText2"],
    ))

    flow_steps = [
        ("Query Intake", "User submits a natural-language request via the Agent UI. The prompt is captured with tenant context and streamed via SSE."),
        ("Use Case Selection", "Active use cases are scored against the prompt using keyword overlap and confidence thresholds. The best match determines which skill chain executes."),
        ("Skill Chain Execution", "Skills run sequentially \u2014 each can invoke external tools (ServiceNow search, Drive retrieval, KB lookup) and emits structured events at start and completion."),
        ("Knowledge Retrieval", "Documents are retrieved from Google Drive using the tenant's classification schema, navigating hierarchical folder structures to find contextually relevant content."),
        ("LLM Synthesis", "Retrieved documents and the query are sent to the configured LLM with a grounded system prompt. The model returns a structured response: summary, recommended steps, source citations, and confidence score."),
        ("Action Recommendation", "Post-resolution, the platform scores available actions against the run context (use case match, keyword overlap, skills used, confidence) and surfaces recommended follow-up actions."),
        ("Action Execution", "Users trigger actions with one click. Multi-phase actions (like catalog extraction) collect input, execute across systems, and return results for interactive refinement."),
    ]

    for i, (title, desc) in enumerate(flow_steps, 1):
        step_data = [[
            Paragraph(f"<b>{i}</b>", ParagraphStyle("_n", fontSize=14, textColor=PRIMARY,
                                                      fontName="Helvetica-Bold", alignment=TA_CENTER)),
            Paragraph(f"<b>{title}</b><br/><font size=10 color='#475569'>{desc}</font>",
                      ParagraphStyle("_d", fontSize=11, leading=16, textColor=DARK_TEXT,
                                      fontName="Helvetica-Bold")),
        ]]
        step_tbl = Table(step_data, colWidths=[0.5 * inch, 5.8 * inch])
        step_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (1, 0), 10),
        ]))
        story.append(step_tbl)

    story.append(Spacer(1, 10))
    story.append(callout_box(
        "<b>Real-time Visibility:</b>  Every stage emits Server-Sent Events that the "
        "frontend renders as a live execution trace \u2014 reasoning steps, tool calls with "
        "latency, skill completion status, and confidence scores. Nothing is a black box.",
        ss,
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  5. SERVICENOW CATALOG EXTRACTION & MODERNIZATION
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. ServiceNow Catalog Extraction & Modernization", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "The flagship capability of OverYonder.ai is extracting live ServiceNow service catalogs "
        "and transforming them into modern web applications. This end-to-end pipeline handles "
        "the entire journey from legacy data to deployed application.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("The Extraction Pipeline", ss["SubSection"]))

    extract_steps = [
        ("Input Collection", "User selects the \"ServiceNow Catalog to Replit\" action. The agent asks for the catalog name. The user types a name (e.g., \"Service Catalog\") and the platform URL-encodes it and constructs the API call."),
        ("ServiceNow Fetch", "The platform calls the ServiceNow catalogbytitleservice REST API with retry logic (2 retries, 90-second timeout per attempt) to handle hibernating dev instances. A successful response returns the full catalog payload."),
        ("Structure-Aware Cleanup", "The raw payload (typically 1.28 MB) is processed by a deterministic cleanup pipeline that understands the ServiceNow catalog structure. It removes the duplicated 'prompts' field (79% of payload), strips sys_* metadata, cleans HTML from descriptions, drops empty values, and preserves all items, categories, variables, and form field choices."),
        ("LLM Draft Generation", "The cleaned catalog (113 KB) is sent to the configured LLM with a system prompt instructing it to generate a precise Replit Agent specification. The LLM identifies every catalog item, category, and form field, then generates a comprehensive React application spec."),
        ("Interactive Refinement", "The draft is presented to the user for review. Users can refine the prompt conversationally \u2014 adding AI chat, search capabilities, or custom features. Only the instruction header is sent to the LLM; the catalog data is reattached automatically."),
        ("Deployment to Replit", "On approval, the prompt is copied to clipboard and Replit opens. The full specification (refined header + catalog data) is pasted into Replit Agent, which builds the application."),
    ]

    for i, (title, desc) in enumerate(extract_steps, 1):
        step_data = [[
            Paragraph(f"<b>{i}</b>", ParagraphStyle("_n", fontSize=14, textColor=PRIMARY,
                                                      fontName="Helvetica-Bold", alignment=TA_CENTER)),
            Paragraph(f"<b>{title}</b><br/><font size=10 color='#475569'>{desc}</font>",
                      ParagraphStyle("_d", fontSize=11, leading=16, textColor=DARK_TEXT,
                                      fontName="Helvetica-Bold")),
        ]]
        step_tbl = Table(step_data, colWidths=[0.5 * inch, 5.8 * inch])
        step_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (1, 0), 10),
        ]))
        story.append(step_tbl)

    story.append(Spacer(1, 10))

    story.append(Paragraph("Payload Optimization", ss["SubSection"]))
    opt_tbl = styled_table(
        ["Metric", "Before", "After", "Improvement"],
        [
            ["Payload Size", "1,286,670 chars", "112,860 chars", "91.8% reduction"],
            ["Catalog Items", "185 (with noise)", "185 (clean)", "100% preserved"],
            ["Categories", "26 (buried in metadata)", "26 (top-level list)", "100% preserved"],
            ["Variables/Fields", "Mixed with sys_* IDs", "Clean (name, type, choices)", "All preserved"],
            ["HTML Markup", "Embedded in descriptions", "Stripped to plain text", "100% cleaned"],
            ["Duplicate Data", "79% (prompts field)", "0%", "Eliminated"],
        ],
        col_widths=[1.3 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch],
    )
    story.append(opt_tbl)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  6. INTERACTIVE PROMPT REFINEMENT
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Interactive Prompt Refinement", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "The initial LLM-generated draft is a starting point, not a final deliverable. "
        "OverYonder.ai provides a conversational refinement loop where users iteratively "
        "shape the application specification through natural language feedback.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("How Refinement Works", ss["SubSection"]))
    story.append(bullet("The draft prompt is split into an <b>instruction header</b> (the textual specification) and the <b>embedded catalog data</b> (the JSON payload)", ss))
    story.append(bullet("Only the instruction header (~200-500 chars) is sent to the LLM for refinement \u2014 the 113 KB catalog JSON is never re-processed", ss))
    story.append(bullet("The LLM incorporates the user's feedback and returns a revised header", ss))
    story.append(bullet("The platform reassembles the refined header with the original catalog data automatically", ss))
    story.append(bullet("Users can iterate multiple times, each round completing in 5-10 seconds", ss))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Example Refinement Requests", ss["SubSection"]))
    story.append(bullet("\"Add an AI-powered chat panel in the upper right corner for natural-language catalog search\"", ss))
    story.append(bullet("\"Users should be able to create new catalog items by typing 'create item' followed by a description\"", ss))
    story.append(bullet("\"Add category-based filtering with a sidebar navigation\"", ss))
    story.append(bullet("\"Include a dark mode toggle and mobile-responsive layout\"", ss))

    story.append(Spacer(1, 10))
    story.append(callout_box(
        "<b>Performance:</b>  By splitting the prompt and only refining the header, each "
        "refinement round processes ~500 chars instead of 113,000+ \u2014 reducing LLM latency "
        "from timeout (2+ minutes) to 5-10 seconds. The catalog data integrity is guaranteed "
        "because it's never modified during refinement.",
        ss,
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("Progress Indicators", ss["SubSection"]))
    story.append(Paragraph(
        "During long-running operations, the Agent UI shows contextual progress messages "
        "that update in real time:",
        ss["BodyText2"],
    ))
    story.append(bullet("\"Connecting to ServiceNow...\" \u2192 \"Fetching catalog data...\" \u2192 \"Cleaning and formatting...\" \u2192 \"Generating draft Replit prompt...\"", ss))
    story.append(bullet("\"Processing your feedback...\" \u2192 \"Refining the Replit prompt...\" \u2192 \"Incorporating changes...\"", ss))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  7. INTEGRATIONS ECOSYSTEM
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("7. Integrations Ecosystem", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "OverYonder.ai connects to the enterprise tools your teams already use. Each integration "
        "exposes tools for agent orchestration and actions for post-resolution execution.",
        ss["BodyText2"],
    ))
    story.append(Spacer(1, 6))

    int_tbl = styled_table(
        ["Integration", "Capabilities", "Key Operations"],
        [
            ["ServiceNow",
             "Search incidents & KB, create incidents, read/write work notes, extract catalogs by title",
             "search_incidents, get_incident_details, search_kb, add_work_note, catalog_by_title"],
            ["Replit",
             "Create applications from prompts, deploy catalog-to-app specifications",
             "build_application, create_repl_with_prompt"],
            ["Google Drive",
             "Navigate classification folders, search/read/create documents",
             "search_documents, read_file, create_file"],
            ["Jira",
             "Search and create issues, retrieve issue details",
             "search_issues, get_issue, create_issue"],
            ["Slack",
             "Post messages to channels, search conversation history",
             "post_message, search_messages"],
            ["GitHub",
             "Search commits and issues across repositories",
             "search_commits, search_issues"],
            ["Salesforce",
             "Search accounts, retrieve case history",
             "search_accounts, get_case_history"],
        ],
        col_widths=[1.1 * inch, 2.5 * inch, 2.7 * inch],
    )
    story.append(int_tbl)

    story.append(Spacer(1, 14))
    story.append(Paragraph("LLM Provider Support", ss["SubSection"]))
    story.append(Paragraph(
        "The platform supports multiple LLM providers with per-tenant assignment and real-time "
        "cost tracking:",
        ss["BodyText2"],
    ))
    story.append(bullet("Anthropic Claude (claude-sonnet-4, claude-haiku-3) \u2014 default provider", ss))
    story.append(bullet("OpenAI (gpt-5, gpt-4o, o3, o3-mini, o4-mini) \u2014 including reasoning models with developer role support", ss))
    story.append(bullet("Per-provider API key management with connection testing", ss))
    story.append(bullet("Token-level pricing configuration (input/output $/1K tokens) for accurate cost calculation", ss))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  8. CONTROL PLANE & ADMINISTRATION
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("8. Control Plane & Administration", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "The admin control plane provides a comprehensive interface for configuring every "
        "aspect of the platform without writing code.",
        ss["BodyText2"],
    ))

    admin_pages_tbl = styled_table(
        ["Admin Page", "Purpose"],
        [
            ["Tenants", "Create, activate, and manage isolated tenants with independent configurations"],
            ["Settings \u2014 LLM Providers", "Add/edit LLM providers with API key testing and token pricing"],
            ["Settings \u2014 Model Matrix", "Assign LLM models per tenant with enable/disable and default selection"],
            ["Settings \u2014 Runtime Defaults", "Configure max tokens per run, per-run and daily cost guardrails"],
            ["Integrations", "Enable/disable integrations, test connections, manage credentials"],
            ["Skills", "Create reusable AI skills with instructions and tool bindings"],
            ["Use Cases", "Build multi-step workflows chaining skills with trigger keywords"],
            ["Actions", "Configure post-resolution actions with parameter sources and scoring rules"],
            ["App Genomes", "Browse captured genomes, view structural details, download artifacts"],
            ["Genome Capture", "5-step wizard to extract application structure from source platforms"],
            ["Genome Insights", "Analytics dashboard with vendor distribution, complexity, and savings"],
            ["Runs", "Browse execution history, drill into run details with full event traces"],
            ["Observability", "KPI dashboard with success rates, confidence trends, cost analysis"],
            ["Cost Ledger", "Daily cost breakdown, model usage distribution, per-run cost analysis"],
        ],
        col_widths=[1.8 * inch, 4.5 * inch],
    )
    story.append(admin_pages_tbl)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  9. ACTIONS & RECOMMENDATIONS ENGINE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("9. Actions & Recommendations Engine", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "After the agent resolves a query, users need to <i>act</i> on the findings. The "
        "recommendations engine surfaces contextually relevant follow-up actions using a "
        "multi-signal scoring algorithm.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Scoring Algorithm", ss["SubSection"]))
    score_tbl = styled_table(
        ["Rule Type", "Signal", "Weight"],
        [
            ["Use Case Match", "Selected use case matches rule value", "+3"],
            ["Keyword Overlap", "Prompt tokens match rule keywords", "+2"],
            ["Skill Match", "Executed skills match rule skills", "+2"],
            ["Confidence Threshold", "Run confidence exceeds threshold", "+1"],
        ],
        col_widths=[1.4 * inch, 3.2 * inch, 0.8 * inch],
    )
    story.append(score_tbl)

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Actions scoring <b>\u2265 2 points</b> are shown as <b>Recommended</b> with a star badge; "
        "the rest appear under <b>Other Available Actions</b>.",
        ss["BodyText2"],
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Available Action Types", ss["SubSection"]))

    action_tbl = styled_table(
        ["Action", "Integration", "Description"],
        [
            ["Create Incident", "ServiceNow", "Create a new incident pre-populated with agent findings"],
            ["Create Knowledge Article", "ServiceNow", "Publish resolution as a KB article"],
            ["ServiceNow Catalog to Replit", "ServiceNow + Replit", "Extract catalog by title, clean, generate app spec, deploy"],
            ["ServiceNow to Replit (URL)", "ServiceNow + Replit", "Extract catalog by web service URL"],
            ["Create Jira Issue", "Jira", "Create a tracking issue with resolution details"],
            ["Send Slack Notification", "Slack", "Post resolution summary to a channel"],
            ["Generate PDF Report", "Internal", "Generate a downloadable PDF report of findings"],
            ["Create Knowledge Doc", "Google Drive", "Create a document in the classification folder structure"],
            ["Build Replit Application", "Replit", "Create a Replit app from a custom prompt"],
        ],
        col_widths=[1.6 * inch, 1.4 * inch, 3.3 * inch],
    )
    story.append(action_tbl)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  10. AGENT CONVERSATIONAL UI
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("10. Agent Conversational UI", ss["SectionTitle"]))
    story.append(divider())
    story.append(Paragraph(
        "The Agent UI is the primary interface where users interact with the platform. It provides "
        "a two-panel layout with a nautical-themed design (deep navy, steel blue, teal accents).",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Left Panel \u2014 Chat & Draft Workspace", ss["SubSection"]))
    story.append(bullet("User messages and agent responses in a conversational thread", ss))
    story.append(bullet("Draft Replit prompts displayed in a structured card with JSON syntax highlighting", ss))
    story.append(bullet("Input collection mode for actions requiring user input (e.g., catalog name)", ss))
    story.append(bullet("Refinement mode with approve/cancel controls", ss))
    story.append(bullet("Contextual progress indicators during long operations", ss))

    story.append(Paragraph("Right Panel \u2014 Live Execution Trace", ss["SubSection"]))
    trace_tbl = styled_table(
        ["Component", "What It Shows"],
        [
            ["Agent Reasoning", "Step-by-step decision trace with animated status indicators"],
            ["Selected Use Case", "Matched workflow with confidence percentage"],
            ["Skill Timeline", "Sequential skill execution with running/completed/failed status"],
            ["Tools & APIs", "Individual API calls with target system, response time, and status code"],
            ["AI Recommendation", "Final resolution with confidence score and source attribution"],
            ["Agent Actions", "Recommended and available follow-up actions with one-click execution"],
        ],
        col_widths=[1.6 * inch, 4.7 * inch],
    )
    story.append(trace_tbl)

    story.append(Spacer(1, 10))
    story.append(Paragraph("Interaction Modes", ss["SubSection"]))
    story.append(bullet("Normal mode: free-form queries processed by the agent orchestration pipeline", ss, bold_prefix="Query"))
    story.append(bullet("Input collection: agent asks for specific input, user provides it, action executes", ss, bold_prefix="Input"))
    story.append(bullet("Draft/refine: iterative prompt editing with approve and cancel controls", ss, bold_prefix="Refine"))
    story.append(bullet("Responsive mobile layout with tabbed navigation for narrow viewports", ss, bold_prefix="Mobile"))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  11. LLM COST TRACKING & OBSERVABILITY
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("11. LLM Cost Tracking & Observability", ss["SectionTitle"]))
    story.append(divider())

    story.append(Paragraph("Per-Call Cost Tracking", ss["SubSection"]))
    story.append(Paragraph(
        "Every LLM API call in the platform \u2014 catalog analysis, draft generation, prompt "
        "refinement, resolution synthesis \u2014 is tracked as an LLMUsageEvent with exact "
        "token counts, model identification, latency, and calculated cost.",
        ss["BodyText2"],
    ))

    cost_tbl = styled_table(
        ["Field", "Description"],
        [
            ["tenant_id", "Tenant isolation for cost aggregation"],
            ["model", "Exact model used (e.g., claude-sonnet-4-20250514)"],
            ["input_tokens / output_tokens", "Token counts from the API response"],
            ["cost", "Calculated from token counts \u00d7 configured pricing"],
            ["latency_ms", "Request duration in milliseconds"],
            ["skill", "Which operation triggered the call (e.g., catalog-draft, catalog-refine)"],
        ],
        col_widths=[2.0 * inch, 4.3 * inch],
    )
    story.append(cost_tbl)

    story.append(Spacer(1, 10))
    story.append(Paragraph("Observability Dashboard", ss["SubSection"]))
    story.append(bullet("Impact overview: total runs, average confidence, resolution time, writeback success rate", ss))
    story.append(bullet("Quality signals: fallback rate, document hit rate, duration metrics", ss))
    story.append(bullet("Model & outcome correlation matrix for performance analysis", ss))
    story.append(bullet("Top classification paths with success rates", ss))
    story.append(bullet("7-day and 30-day trend analysis for all key metrics", ss))
    story.append(bullet("Cost ledger: daily spend breakdown, model usage mix, per-tenant distribution", ss))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Runtime Guardrails", ss["SubSection"]))
    story.append(bullet("Max tokens per run \u2014 configurable per tenant", ss))
    story.append(bullet("Cost guardrail per run \u2014 USD limit per execution", ss))
    story.append(bullet("Daily cost guardrail \u2014 USD limit per day per tenant", ss))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  12. SECURITY & MULTI-TENANCY
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("12. Security & Multi-Tenancy", ss["SectionTitle"]))
    story.append(divider())

    story.append(Paragraph("Tenant Isolation", ss["SubSection"]))
    story.append(Paragraph(
        "Every API endpoint is scoped to a tenant ID. All 23 data stores enforce tenant-level "
        "isolation \u2014 skills, use cases, integrations, actions, runs, LLM configs, and "
        "cost tracking are all partitioned. Tenants cannot access each other's data.",
        ss["BodyText2"],
    ))

    story.append(Paragraph("Credential Management", ss["SubSection"]))
    story.append(bullet("Per-tenant integration credentials (ServiceNow Basic Auth, Google Drive OAuth 2.0, Replit session)", ss))
    story.append(bullet("Per-provider LLM API keys with masked display and connection testing", ss))
    story.append(bullet("Outbound API calls always use the requesting tenant's credentials", ss))

    story.append(Paragraph("Data Handling", ss["SubSection"]))
    story.append(bullet("LLM synthesis uses grounded prompts \u2014 models instructed to use only provided documents", ss))
    story.append(bullet("Source attribution on every resolution ensures traceability", ss))
    story.append(bullet("ServiceNow catalog data is cleaned locally (no LLM exposure for the raw payload)", ss))

    story.append(Spacer(1, 20))

    # ═══════════════════════════════════════════════════════════════════════
    #  13. EXTENSIBILITY & ROADMAP
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("13. Extensibility & Roadmap", ss["SectionTitle"]))
    story.append(divider())

    story.append(Paragraph("Built for Extension", ss["SubSection"]))
    story.append(bullet("New integrations: implement a tool adapter (async function) and register in the tool catalog", ss))
    story.append(bullet("New skills: create via the admin UI with instructions and tool bindings \u2014 no deployment needed", ss))
    story.append(bullet("New actions: configure integration target, operation, parameters, and scoring rules via the admin UI", ss))
    story.append(bullet("Database migration: swap in-memory stores for PostgreSQL by implementing the ABC interfaces", ss))
    story.append(bullet("New source platforms: extend the extraction pipeline to Salesforce, SAP, or custom APIs", ss))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Platform Roadmap", ss["SubSection"]))

    roadmap_tbl = styled_table(
        ["Area", "Planned Capability"],
        [
            ["Source Platforms", "Salesforce Service Cloud extraction, SAP catalog portability, custom REST API adapters"],
            ["Target Platforms", "Vercel, Netlify, AWS Amplify deployment targets beyond Replit"],
            ["Intelligence", "Multi-turn agent conversations, RAG with vector search, auto-classification"],
            ["Actions", "Action chaining (multi-step workflows), approval gates, scheduled actions"],
            ["Observability", "SLA monitoring, anomaly detection on KPI trends, cost forecasting"],
            ["Deployment", "Docker containerization, Kubernetes manifests, CI/CD pipeline templates"],
        ],
        col_widths=[1.4 * inch, 4.9 * inch],
    )
    story.append(roadmap_tbl)

    story.append(Spacer(1, 20))
    story.append(divider())
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "OverYonder.ai \u2014 Agentic Enterprise Application Portability  |  Platform Overview  |  March 2026",
        ss["FooterText"],
    ))

    # ── Build ───────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"PDF generated: {OUT}")


if __name__ == "__main__":
    build_pdf()
