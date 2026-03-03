# McManus — History

## Project Context
**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado

## Learnings
- Joined the team on 2026-03-03 as DevOps / Pipeline Specialist
- 2026-03-03: Created test/verification decorator (`decorator/test-decorator.yml`). Key takeaway: use `${{ if }}` compile-time gate for decorators that should only appear conditionally — prevents step from even being injected into pipeline definitions. Combine with `condition:` for runtime opt-out. Inline `CmdLine@2` is sufficient for simple verification — no need for a custom task.
- 2026-03-03: Decorator contributions share the same `type` (`ms.azure-pipelines.pipeline-decorator`) and can share the same `targets` array. Multiple decorator contributions in one extension work fine — each gets its own contribution `id` and template path.

## Cross-Agent Updates

### 2026-03-03T12:30:00Z — Keaton: ARCHITECTURE.md Manifest Corrections
Keaton corrected the extension manifest structure in ARCHITECTURE.md (D10–D15):
- Contribution type is `ms.azure-pipelines.pipeline-decorator` (not per-target types)
- Target for post-job is `ms.azure-pipelines-agent-job.post-job-tasks`
- Files entry requires exact path + `contentType`
- Decorators require private extensions (no public marketplace)
- `condition:` (runtime) vs `${{ if }}` (compile-time) both valid in decorator templates
- `system.debugContext` enables decorator expansion tracing

**Impact on McManus:** Use corrected values when authoring `vss-extension.json`, decorator YAML, and pipeline packaging scripts.

### 2026-03-03T13:00:00Z — Keaton: Deployment Guide Created
Keaton created `DEPLOYMENT.md` — 8-phase deployment guide covering prerequisites, build, publish, install, PAT config, test verification (using McManus's test decorator in Phase F), failure analysis testing, and updates. Troubleshooting section covers 10 common issues. Updated ARCHITECTURE.md Section 11 with link.

**Impact on McManus:** Phase F of the deployment guide references the test decorator (`COPILOT_TEST_MODE`). Ensure test decorator YAML and manifest contribution stay aligned with the deployment instructions.
