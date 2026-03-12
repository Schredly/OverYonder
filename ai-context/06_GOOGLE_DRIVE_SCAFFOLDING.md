# Google Drive Integration — OverYonder.ai Platform

## Role in the platform
Google Drive serves as the knowledge and document storage layer:
- Store exported genome artifacts (JSON, PDF)
- Store migration plans and analysis reports
- Serve as a knowledge base for agent document retrieval during runs
- House per-tenant organized document structure

## Drive layout
Under the configured root folder per tenant:

```
AgenticKnowledge/
  {tenant_id}/
    _schema/                          # Configuration artifacts
      classification_schema.json
      integration_config_redacted.json
    genomes/                          # Exported genome artifacts
      {genome_id}_genome.json
      {genome_id}_migration_plan.json
    documents/                        # Knowledge documents
      by_vendor/
        ServiceNow/
        Salesforce/
        Jira/
      by_category/
        IT_Service_Management/
        HR_Operations/
        Customer_Service/
    reports/                          # Generated analysis reports
      migration_savings_report.pdf
      platform_overview.pdf
```

## Idempotency
`ensure_folder(name, parent_id)` must:
- Search for existing folder by name + parent
- Create if missing
- Return folder ID

## What gets stored
- **_schema/**: Tenant configuration snapshots (redacted credentials)
- **genomes/**: Exported genome JSON artifacts for portability
- **documents/**: Knowledge documents organized by vendor and category
- **reports/**: Generated PDF reports (migration analysis, platform overview)

## Search strategy
Given a query from an agent run:
- Search Drive within `{tenant}/documents/` for relevant docs
- Use filename + folder scoping for targeted retrieval
- Return top N document IDs + names + links
- Future: embeddings-based semantic search

## Integration configuration
- Root folder ID (required)
- Shared Drive ID (optional, for shared drives)
- Service account credentials
- Connection test: verify folder access
