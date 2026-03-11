# OverYonder.ai — Platform Demo Video Script

**Duration:** ~8-10 minutes
**Tone:** Professional but conversational, showcasing real capabilities

---

## INTRO (0:00 – 0:45)

**[Screen: OverYonder.ai logo animation]**

> Meet OverYonder.ai — an enterprise agentic intelligence platform that transforms how organizations manage IT services.
>
> Instead of manually triaging tickets, searching knowledge bases, and copying data between systems — OverYonder.ai orchestrates AI agents that do this automatically, with full transparency into every step.
>
> Today I'll walk you through the platform — starting with the control plane, then diving deep into our Agent UI and a live demo where we extract a full ServiceNow catalog and generate a modern web application from it.

---

## SECTION 1: CONTROL PLANE OVERVIEW (0:45 – 2:00)

**[Screen: Settings page — AI Infrastructure]**

> Let's start with the control plane. This is where you configure the intelligence layer.
>
> Here in Settings, we manage LLM providers — you can connect Anthropic Claude, OpenAI, or any supported model. Each provider gets tested on connection, and you set token-level pricing so the platform tracks costs in real time.
>
> Below that is the Tenant Model Access Matrix. OverYonder.ai is multi-tenant from the ground up — each tenant can have different models assigned, different defaults, and independent cost guardrails.

**[Screen: Integrations page]**

> On the Integrations page, we have a catalog of enterprise connectors — ServiceNow, Google Drive, Jira, Slack, Replit, and more. Each integration is configured per-tenant with real credentials, and every connection is testable right from the UI.

**[Screen: Use Cases page]**

> Use cases define the workflows your agents execute. Each use case chains together skills — reusable AI capabilities like "Incident Lookup," "Knowledge Base Search," or "Document Retrieval." When a user submits a request, the platform matches it to the best use case and executes the skill chain automatically.

---

## SECTION 2: THE AGENT UI (2:00 – 4:00)

**[Screen: Agent UI — empty state]**

> This is the Agent UI — the primary interface where users interact with the platform. Think of it as an AI-powered service desk agent that reasons through problems in real time.

**[Screen: Type a prompt like "I have a user reporting email delivery failures across the marketing department"]**

> Let's submit a real request. Watch the right panel — this is the execution trace. You can see exactly what the agent is doing.
>
> First, it classifies the request and selects a use case — "Email Incident Diagnosis" with a confidence score.
>
> Then it starts executing skills. Each skill shows its status — running, then completed with a duration badge. You can see the actual tool calls being made — a ServiceNow incident search, a knowledge base lookup, a Google Drive document retrieval.
>
> Every API call shows the system it hit, the response time, and the status code. Nothing is a black box.

**[Screen: Resolution appears with recommended actions]**

> The agent synthesizes a resolution from all the evidence it gathered — with a confidence score and specific next steps.
>
> Below the resolution, you see context-aware action recommendations. These aren't static buttons — the platform scores every available action against the current run context. Actions matching the use case, keywords, and skills used get scored higher and marked as "Recommended."
>
> From here, a user can create a ServiceNow incident, generate a PDF report, send a Slack notification, or create a Jira ticket — all with a single click, pre-populated with the agent's findings.

---

## SECTION 3: SERVICENOW CATALOG EXTRACTION (4:00 – 6:30)

**[Screen: Agent UI — click "ServiceNow Catalog to Replit" action]**

> Now let's look at the feature I'm most excited about — taking a live ServiceNow service catalog and transforming it into a modern web application.
>
> I'll click the "ServiceNow Catalog to Replit" action. The agent asks me for the catalog name.

**[Screen: Type "Service Catalog" and submit]**

> I'll type "Service Catalog" — this is a real production catalog in our ServiceNow instance.
>
> Watch the progress indicators — the platform is connecting to ServiceNow, fetching the catalog data, cleaning and formatting it, then generating a draft prompt.

**[Screen: Progress steps cycling: "Connecting to ServiceNow..." → "Fetching catalog..." → "Cleaning and formatting..." → "Generating draft..."]**

> What's happening behind the scenes is significant. The raw ServiceNow catalog payload is over 1.2 megabytes — packed with system IDs, HTML markup, metadata fields, and duplicated prompt data.
>
> Our pipeline strips all of that noise. It removes the sys_* fields, cleans the HTML out of descriptions, drops empty values and internal workflow metadata, and eliminates an entire duplicated "prompts" block that accounts for 79% of the payload.
>
> The result? A clean 113 kilobyte JSON with every catalog item, every category, every variable and form field preserved — just without the noise. All 185 items and 26 categories, intact and human-readable.
>
> The platform then sends this cleaned data to the LLM, which generates a precise Replit Agent prompt — specifying React, the exact catalog items to build, form fields per item, and the request submission flow.

**[Screen: Draft appears in the Agent UI]**

> Here's the draft. It's a complete specification for building a service catalog application — and it's based entirely on the real data from ServiceNow. No hallucinated items, no made-up categories.

---

## SECTION 4: PROMPT REFINEMENT (6:30 – 8:00)

**[Screen: Type refinement feedback in the chat]**

> But we're not done. The draft is just the starting point. I can refine it conversationally.
>
> Let me add some requirements — "Add an AI-powered chat panel in the upper right corner. Users should be able to search the catalog by natural language, and they can create new items by saying 'create item' followed by a description."

**[Screen: Progress steps: "Processing your feedback..." → "Refining the Replit prompt..."]**

> The refinement is fast because the platform is smart about what it sends to the LLM. It splits the prompt into the instruction header and the catalog data. Only the instructions get refined — the 113K of catalog JSON stays untouched and gets reattached automatically. So instead of processing 100K+ tokens, the LLM handles just the few hundred characters of instructions.

**[Screen: Refined draft appears with AI chat section added]**

> There it is — the refined prompt now includes the AI chat specifications, the natural language search, and the item creation flow. The catalog data is still there, unchanged.
>
> I can keep iterating — each refinement round takes just a few seconds. When I'm satisfied, I click "Approve & Send to Replit."

**[Screen: Click Approve — Replit opens in new tab]**

> The prompt is copied to my clipboard and Replit opens. I paste it in, and Replit Agent starts building a fully functional service catalog application from the real ServiceNow data — categories, items, form fields, and now an AI-powered chat interface.
>
> We just went from a legacy ServiceNow catalog to a modern React application in under five minutes.

---

## SECTION 5: COST TRANSPARENCY & OBSERVABILITY (8:00 – 9:00)

**[Screen: Cost Ledger page]**

> Every LLM call in that entire flow — the catalog cleanup, the draft generation, the refinement — was tracked. You can see the exact token counts, the model used, the cost per call, and the latency.
>
> On the observability dashboard, we track resolution confidence, execution times, document hit rates, and fallback patterns across all tenant runs. This gives you the data to tune your agents, optimize your model choices, and prove ROI.

---

## CLOSING (9:00 – 9:30)

**[Screen: Platform overview / OverYonder.ai logo]**

> OverYonder.ai isn't just another chatbot. It's a full agentic platform — multi-tenant, multi-model, with real enterprise integrations, transparent execution traces, intelligent action recommendations, and the ability to transform legacy systems into modern applications.
>
> Whether you're automating IT service management, modernizing your service catalog, or building the next generation of AI-powered workflows — OverYonder.ai gets you there.
>
> Thanks for watching.

---

## PRODUCTION NOTES

**Key moments to capture in screen recording:**
1. Settings page with LLM provider config and tenant matrix
2. Integration catalog with ServiceNow/Google Drive/Replit configs
3. Agent UI empty state → prompt submission → real-time execution trace
4. Resolution with recommended actions (star badges, scoring)
5. ServiceNow Catalog to Replit: input collection → progress steps → draft
6. Refinement: typing feedback → fast refinement → refined draft
7. Approve → Replit opens → paste prompt → app generation starts
8. Cost ledger showing tracked LLM usage from the demo

**Suggested B-roll:**
- Close-up of execution trace panel filling in real-time
- Side-by-side: raw ServiceNow JSON (1.2MB) vs cleaned output (113KB)
- Progress indicator cycling through steps
- Replit Agent building the app from the pasted prompt
