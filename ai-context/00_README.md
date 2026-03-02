# AI Context Pack — Self-Correcting Agentic System (Simplified MVP)

This folder contains grounding documents for Claude (developer) and a “new GPT context window” primer for quickly bootstrapping future ChatGPT threads.

**MVP scope (intentionally small):**
- Multi-tenant
- Wizard onboarding per tenant
- **ServiceNow only** (pluggable connector interface for future Jira/Salesforce)
- Manual classification schema (N levels) configured in wizard
- Google Drive as knowledge source (pluggable storage interface)
- Agent run orchestration with **skills** + **reasoning events**
- ServiceNow flow: UI Action sends ticket payload → agent retrieves Drive docs → proposes solution → writes to work notes
- Feedback capture (“successful?”) + minimal evaluation metrics

**Non-goals for MVP:**
- Auto-discovery of classification from ServiceNow (future)
- Jira/Salesforce implementations (future)
- Full “golden data pipeline” normalization (future)
- Full prompt routing optimization loop (future)
- Vector DB / embeddings (future; can add later)

Recommended read order:
1. 12_GPT_CONTEXT_WINDOW.md
2. 01_MVP_PRODUCT_SPEC.md
3. 02_ARCHITECTURE.md
4. 05_SERVICE_NOW_INTEGRATION.md
5. 06_GOOGLE_DRIVE_SCAFFOLDING.md
6. 07_AGENT_ORCHESTRATION.md
7. 09_EVALUATION_AND_FEEDBACK.md
