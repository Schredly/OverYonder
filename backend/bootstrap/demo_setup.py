"""Auto-seed demo tenant with integrations, skills, and a use case."""

import uuid

from models import (
    Action,
    ActionParameter,
    ActionRule,
    Integration,
    Skill,
    Tenant,
    UseCase,
    UseCaseStep,
)


async def seed_demo_data(app) -> None:
    """Populate stores with demo data if the 'acme' tenant doesn't exist yet."""
    tenant_store = app.state.tenant_store
    existing = await tenant_store.get("acme")
    if existing is not None:
        return  # Already seeded

    # --- Tenant ---
    # Insert directly into the store dict to control the ID
    tenant = Tenant(id="acme", name="ACME Corp", status="active")
    tenant_store._tenants["acme"] = tenant

    # --- ServiceNow integration ---
    await app.state.snow_config_store.upsert(
        "acme",
        instance_url="https://dev221705.service-now.com",
        username="admin",
        password="1Surfer1!",
    )

    snow_integration = Integration(
        id=f"int_{uuid.uuid4().hex[:12]}",
        tenant_id="acme",
        integration_type="servicenow",
        enabled=True,
        config={
            "instance_url": "https://dev221705.service-now.com",
            "username": "admin",
            "password": "1Surfer1!",
        },
    )
    await app.state.integration_store.create(snow_integration)

    # --- Skills ---
    skill_defs = [
        {
            "name": "Incident Lookup",
            "description": "Search ServiceNow incidents for matching records",
            "tools": ["servicenow.search_incidents"],
        },
        {
            "name": "Knowledge Base Search",
            "description": "Search ServiceNow knowledge base for relevant articles",
            "tools": ["servicenow.search_kb"],
        },
        {
            "name": "Documentation Search",
            "description": "Search Google Drive documents for technical documentation",
            "tools": ["google-drive.search_documents"],
        },
        {
            "name": "Diagnosis Summary",
            "description": "Compile findings into a diagnosis and resolution summary",
            "tools": [],
        },
    ]

    skill_ids: list[str] = []
    for sd in skill_defs:
        skill_id = f"sk_{uuid.uuid4().hex[:12]}"
        skill_ids.append(skill_id)
        skill = Skill(
            id=skill_id,
            tenant_id="acme",
            name=sd["name"],
            description=sd["description"],
            tools=sd["tools"],
        )
        await app.state.skill_store.create(skill)

    # --- Use Case: Email Incident Diagnosis ---
    steps = [
        UseCaseStep(step_id=f"step_{i}", skill_id=skill_ids[i], name=skill_defs[i]["name"])
        for i in range(len(skill_defs))
    ]

    use_case = UseCase(
        id=f"uc_{uuid.uuid4().hex[:12]}",
        tenant_id="acme",
        name="Email Incident Diagnosis",
        description="Diagnoses email-related incidents by searching incidents, KB articles, and documentation",
        status="active",
        triggers=["email", "attachment", "smtp", "mail", "inbox", "outlook", "exchange"],
        steps=steps,
    )
    await app.state.use_case_store.create(use_case)

    # --- Actions ---
    action_defs = [
        {
            "name": "Create Incident",
            "description": "Creates a new incident in ServiceNow with agent findings",
            "integration_id": "servicenow",
            "operation": "incident.create",
            "parameters": [
                ActionParameter(name="title", source="user_prompt"),
                ActionParameter(name="description", source="agent_result"),
                ActionParameter(name="priority", source="static", value="3"),
            ],
            "rules": [
                ActionRule(type="use_case", operator="equals", value="Email Incident Diagnosis"),
                ActionRule(type="keyword", operator="contains", value="email,incident,outage,smtp,exchange,outlook"),
                ActionRule(type="skill", operator="contains", value="Incident Lookup"),
                ActionRule(type="confidence", operator="greater_than", value="0.10"),
            ],
        },
        {
            "name": "Create Jira Issue",
            "description": "Creates a new issue in Jira project with specified fields",
            "integration_id": "jira",
            "operation": "issue.create",
            "parameters": [
                ActionParameter(name="summary", source="user_prompt"),
                ActionParameter(name="description", source="agent_result"),
            ],
            "rules": [
                ActionRule(type="keyword", operator="contains", value="bug,issue,task,feature,ticket,jira"),
            ],
        },
        {
            "name": "Generate PDF Report",
            "description": "Generates a PDF report from agent analysis results",
            "integration_id": "internal",
            "operation": "pdf.generate",
            "parameters": [
                ActionParameter(name="content", source="agent_result"),
            ],
            "rules": [
                ActionRule(type="confidence", operator="greater_than", value="0.15"),
                ActionRule(type="keyword", operator="contains", value="report,summary,diagnosis,analysis,pdf"),
            ],
        },
        {
            "name": "Send Slack Notification",
            "description": "Sends a notification message to a specified Slack channel",
            "integration_id": "slack",
            "operation": "message.post",
            "parameters": [
                ActionParameter(name="channel", source="static", value="#incidents"),
                ActionParameter(name="text", source="agent_result"),
            ],
            "rules": [
                ActionRule(type="keyword", operator="contains", value="notify,alert,team,slack,urgent"),
            ],
            "status": "disabled",
        },
        {
            "name": "Create Google Doc",
            "description": "Creates a new Google Doc with agent-generated content",
            "integration_id": "google-drive",
            "operation": "document.create",
            "parameters": [
                ActionParameter(name="title", source="user_prompt"),
                ActionParameter(name="content", source="agent_result"),
            ],
            "rules": [
                ActionRule(type="skill", operator="contains", value="Documentation Search"),
                ActionRule(type="keyword", operator="contains", value="document,doc,google,drive,save,write"),
            ],
        },
    ]

    for ad in action_defs:
        action = Action(
            id=f"act_{uuid.uuid4().hex[:12]}",
            tenant_id="acme",
            name=ad["name"],
            description=ad["description"],
            integration_id=ad["integration_id"],
            operation=ad["operation"],
            parameters=ad.get("parameters", []),
            rules=ad.get("rules", []),
            status=ad.get("status", "active"),
        )
        await app.state.action_store.create(action)

    print(f"[demo_setup] Seeded 'acme' tenant with ServiceNow integration, 4 skills, 1 use case, and {len(action_defs)} actions")
