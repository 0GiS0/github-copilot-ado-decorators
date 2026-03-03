# Hockney — History

## Project Context
**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado

## Learnings
- Joined the team on 2026-03-03 as Tester
- Issue #9: Implemented 31 unit tests across 4 suites (log-collector, prompt-builder, ai-analyzer, output-formatter). All error paths from ARCHITECTURE.md §8 covered. PR #31.
- Jest config must be `.js` (not `.ts`) unless `ts-node` is installed — ts-jest alone is not enough for config parsing.
- `moduleNameMapper` with `'^(\\.{1,2}/.*)\\.js$': '$1'` is essential for NodeNext module resolution in tests.
- The `https.request` mock needs `EventEmitter`-based streams with `process.nextTick` to properly simulate async behavior.
- When mocking `child_process.execFile`, the return value must include an `.on()` method since the source code attaches an `error` listener to the child process.
- Shell escape in `prompt-builder.ts` replaces `'` with `'\''` — test assertions must account for this exact pattern.

## Cross-Agent Updates

### 2026-03-03T12:30:00Z — Keaton: ARCHITECTURE.md Manifest Corrections
Keaton corrected the extension manifest structure in ARCHITECTURE.md (D10–D15):
- Contribution type is `ms.azure-pipelines.pipeline-decorator` (not per-target types)
- Target for post-job is `ms.azure-pipelines-agent-job.post-job-tasks`
- Files entry requires exact path + `contentType`
- Decorators require private extensions (no public marketplace)
- `condition:` (runtime) vs `${{ if }}` (compile-time) both valid in decorator templates
- `system.debugContext` enables decorator expansion tracing

**Impact on Hockney:** Validate test assertions against corrected manifest values. Private extension constraint affects test deployment strategy.
