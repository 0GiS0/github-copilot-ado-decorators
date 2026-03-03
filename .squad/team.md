# Team

## Project Context

**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Description:** An Azure DevOps extension that uses pipeline decorators to inject a diagnostic step into pipelines. When a pipeline fails, this step reads all pipeline logs, sends them to GitHub Copilot for analysis, and presents the root cause and fix suggestions. Authentication to Copilot is via a PAT.
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado (existing ADO extension with Copilot integration)

## Members

| Name | Role | Model Pref | Badge |
|------|------|-----------|-------|
| Keaton | Lead | auto | 🏗️ Lead |
| Verbal | Backend Dev | auto | 🔧 Backend |
| McManus | DevOps / Pipeline Specialist | auto | ⚙️ DevOps |
| Hockney | Tester | auto | 🧪 Tester |
| Scribe | Session Logger | claude-haiku-4.5 | 📋 Scribe |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Architecture Notes

- **Extension type:** Pipeline Decorator (not a hub/tab extension)
- **Decorator behavior:** Injects a post-job step that runs only on failure (`condition: failed()`)
- **Log analysis flow:** Read pipeline logs via ADO REST API → send to GitHub Copilot API → display analysis
- **Auth:** GitHub PAT for Copilot API access (stored as pipeline variable/service connection)
- **Output:** Analysis displayed as task output in the pipeline run (and potentially as a custom tab)
