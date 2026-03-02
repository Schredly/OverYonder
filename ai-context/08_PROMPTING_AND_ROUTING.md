# Prompting + Routing (Thin MVP)

## One baseline prompt
Start with one high-quality prompt for ServiceNow incident resolution.

## Prompt template inputs
- Ticket fields: title, description
- Classification path: levels (N)
- Retrieved doc titles + snippets + links
- Tenant policy notes (optional)

## Multi-prompt routing (future-ready, minimal now)
Define a config object per tenant:
- `route_key = join(classification values with "/")`
- map route_key → prompt_template_id

MVP: implement storage shape only; default to baseline.

## Guardrails
- Never fabricate policy or steps; if doc evidence missing, say so
- Provide “next best action” and questions to ask
- Keep output format stable for writeback

## Output format (writeback)
- Summary (1 paragraph)
- Recommended steps (bulleted)
- Citations: doc links
- Confidence (0–1)
- Run id
