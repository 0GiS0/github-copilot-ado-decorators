# Verbal — History

## Project Context
**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado

## Learnings
- Joined the team on 2026-03-03 as Backend Dev
- **Issue #3 completed (PR #26):** Implemented `config.ts` and `index.ts` entry point
  - `readConfig()` reads PAT from Generic service connection via `tl.getEndpointAuthorizationParameter(connectedServiceName, 'password', false)`
  - PAT masked immediately with `tl.setSecret()` — critical for security
  - All error paths use `tl.TaskResult.SucceededWithIssues` — never exit non-zero (D7)
  - Optional inputs (`maxLogLines`, `copilotNpxTimeout`) parsed with `parseInt` + `isNaN` fallback to defaults
  - Key files: `src/copilot-failure-analysis-task/config.ts`, `src/copilot-failure-analysis-task/index.ts`
  - Version bumped to `0.2.0` in `azure-devops-extensions-dev.json`

- **Issues #4, #5, #6, #7 completed (PR #28):** Implemented 4 core analysis modules on branch `feature/4-7-core-modules`
  - `log-collector.ts` (#4): ADO Timeline API integration using built-in `https` module; fetches failed Task records, retrieves logs, truncates to last N lines, collects issues from timeline
  - `prompt-builder.ts` (#5): Builds CI/CD analyst prompt with pipeline context; smart truncation prioritises error lines when exceeding ~48KB; shell-escapes output for CLI safety
  - `ai-analyzer.ts` (#6): Spawns `npx @github/copilot -sp` via `child_process.execFile`; handles timeout/auth/empty/CLI-not-found errors; sanitises PAT from error messages; never throws
  - `output-formatter.ts` (#7): Generates Markdown report with metadata table, analysis, disclaimer; attaches via `##vso[task.uploadsummary]`; also prints to stdout
  - `index.ts` updated: removed placeholders, imported and wired all 4 modules in sequence (getFailedStepLogs → buildPrompt → analyzeLogs → formatAndDisplay)
  - Version bumped to `0.3.0` in `azure-devops-extension-dev.json`
  - Key decisions respected: D1-R (Copilot CLI via npx), D2-SC (service connection), D7 (never fail pipeline), D8-R (built-in https only)
  - All imports use `.js` extensions for NodeNext module resolution compatibility

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
