# Wizard UI (Simplified)

## Why wizard?
It enforces the correct onboarding order:
Tenant → ServiceNow connector → manual classification → Google Drive scaffold → activate.

## Step order (MVP)
1. **Create Tenant**
2. **Configure ServiceNow connector**
   - instance URL, username, password
   - test connection
3. **Configure Classification Schema (manual)**
   - define N levels (e.g., Category, Subcategory, ProductLine, IssueType)
4. **Configure Google Drive**
   - root folder id (+ optional shared drive id)
   - test connection
5. **Scaffold Drive folders**
   - preview + apply (idempotent)
6. **Activate Tenant**
   - generate shared secret for ServiceNow to call platform
   - show “ServiceNow Integration Instructions” snippet

## Design notes for “reasoning UI”
- Skills list shows state + one-line summary
- Reasoning details are collapsed; hover or click opens a drawer
- Show doc sources and writeback status in result panel
