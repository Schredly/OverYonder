# AI Context Pack — OverYonder.ai: Agentic Enterprise Application Portability Platform

This folder contains grounding documents for Claude (developer) and a "new GPT context window" primer for quickly bootstrapping future ChatGPT threads.

**Platform identity:**
OverYonder.ai is an agentic platform that helps enterprise companies **extract, analyze, and migrate** applications across platforms to modernize operations and lower costs.

**Core capabilities:**
- **Genome Extraction:** Connect to source platforms (ServiceNow, Salesforce, Jira, Zendesk, Workday) and capture a complete "application genome" — objects, workflows, fields, and relationships
- **Migration Analysis:** Compare legacy vs. migrated costs, assess workflow complexity, calculate savings potential
- **Application Portability:** Rebuild applications on target platforms using the extracted genome as a blueprint
- **Multi-tenant control plane:** Tenants, integrations, skills, use cases, actions — all tenant-scoped
- **Agent orchestration:** Skill-based agent chain with real-time reasoning events and LLM cost tracking
- **Observability:** Run history, LLM usage ledger, cost tracking

**Platform modules (current):**
- Tenants — multi-tenant management
- Integrations — platform connections (ServiceNow, Salesforce, Jira, Slack, etc.)
- Skills — agent skill definitions
- Use Cases — orchestrated multi-skill workflows
- Actions — agent action catalog with visibility rules
- App Genomes — genome capture, listing, detail views, and insights dashboard
- Observability — runs history, LLM usage tracking, cost ledger
- Agent UI — conversational agent interface
- Settings — LLM model configuration

Recommended read order:
1. 12_GPT_CONTEXT_WINDOW.md
2. 01_MVP_PRODUCT_SPEC.md
3. 02_ARCHITECTURE.md
4. 03_DATA_MODEL.md
5. 07_AGENT_ORCHESTRATION.md
6. 05_SERVICE_NOW_INTEGRATION.md
7. 04_WIZARD_UI.md
8. 09_EVALUATION_AND_FEEDBACK.md
