# Verbal — History

## Project Context
**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado

## Learnings
- Joined the team on 2026-03-03 as Backend Dev

## Cross-Agent Updates

### 2026-03-03T12:30:00Z — Keaton: ARCHITECTURE.md Manifest Corrections
Keaton corrected the extension manifest structure in ARCHITECTURE.md (D10–D15):
- Contribution type is `ms.azure-pipelines.pipeline-decorator` (not per-target types)
- Target for post-job is `ms.azure-pipelines-agent-job.post-job-tasks`
- Files entry requires exact path + `contentType`
- Decorators require private extensions (no public marketplace)
- `condition:` (runtime) vs `${{ if }}` (compile-time) both valid in decorator templates
- `system.debugContext` enables decorator expansion tracing

**Impact on Verbal:** Use corrected contribution type and targets when implementing task code that references extension manifest values.
