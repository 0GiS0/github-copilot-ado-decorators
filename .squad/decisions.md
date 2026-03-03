# Decisions

> Canonical decision ledger. Append-only.

---

## D1: AI Integration — Direct API over gh copilot CLI
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Superseded by D1-R
Use direct HTTPS calls to GitHub Models API via Node.js `https` module. Rejected `gh copilot` CLI (100 MB overhead, limited prompt control).

## D1-R: AI Integration — Copilot CLI via npx (REPLACES D1)
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Use `npx @github/copilot -sp "prompt"` for log analysis. Zero-install, silent prompt mode, Copilot handles model routing. Requires Node.js 22+.

## D2: PAT Storage — Variable Group with Secret Variable
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Updated by D2-R
Store GitHub PAT in ADO Variable Group (`CopilotFailureAnalysis`) as secret variable `COPILOT_GITHUB_PAT`.

## D2-R: PAT Authentication — GITHUB_TOKEN for Copilot CLI (UPDATES D2)
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Decorator sets `GITHUB_TOKEN` env var from `COPILOT_GITHUB_PAT`. CLI reads `GITHUB_TOKEN`. PAT needs active Copilot license, no special scope.

## D3: Output — Pipeline Run Summary (Markdown)
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Display analysis via `##vso[task.uploadsummary]` + stdout. Visible in Extensions tab, persists with run.

## D4: Decorator Targeting — All Jobs, Condition: failed()
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Target all agent jobs. Step runs only on failure via `condition: and(failed(), ne(variables['COPILOT_ANALYSIS_DISABLED'], 'true'))`.

## D5: Implementation — Custom Build Task (TypeScript/Node.js)
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Build task bundled with extension, referenced by decorator YAML. TypeScript for type safety and testability.

## D6: Project Structure
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Flat task structure under `src/copilot-failure-analysis-task/`. Decorator YAML in `decorator/` directory.

## D7: Error Handling Philosophy
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Analysis step NEVER fails the pipeline. All errors → exit 0 with warning.

## D8: Minimal Dependencies
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Updated by D8-R
Only `azure-pipelines-task-lib` runtime. Built-in `https` for HTTP.

## D8-R: Dependencies — npx Runtime Install (UPDATES D8)
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Bundled: `azure-pipelines-task-lib`. Runtime: `@github/copilot` via npx. Built-in `https` for ADO REST API, `child_process` for CLI.

## D9: Invocation Strategy — npx over Global Install
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Use `npx @github/copilot -sp` — no global install, npx caches after first download, no permission issues.

## D10: Contribution type corrected
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
Changed from `ms.azure-pipelines-agent-job.post-job-steps` to `ms.azure-pipelines.pipeline-decorator`. Single contribution type for all decorators; injection point controlled by `targets`.

## D11: Contribution targets corrected
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
Changed from `ms.azure-pipelines-agent-job` to `ms.azure-pipelines-agent-job.post-job-tasks`. Correct target for post-job injection.

## D12: Files entry corrected
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
Changed to exact file path with `contentType`: `{ "path": "decorator/copilot-failure-analysis.yml", "addressable": true, "contentType": "text/plain" }`.

## D13: Private extension requirement documented
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
Pipeline decorators can ONLY be contributed by private extensions. Cannot be published to public marketplace. Must be shared privately with specific organizations.

## D14: `condition:` vs `${{ if }}` explanation
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
`${{ if }}` = compile-time (template expansion). `condition:` = runtime. Both can coexist in decorator templates. Our `condition: and(failed(), ...)` is correct.

## D15: Debug context documented
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Accepted
`system.debugContext` variable — set to `true` to see decorator template expansion context at runtime.

## D16: Add Test/Verification Decorator
**Date:** 2026-03-03 | **Author:** McManus | **Status:** Proposed
Added `decorator/test-decorator.yml` — second decorator contribution (`copilot-test-decorator`) for verifying extension installation. Compile-time gate via `${{ if eq(variables['COPILOT_TEST_MODE'], 'true') }}` ensures zero impact on normal pipelines. Runtime opt-out via `COPILOT_TEST_DECORATOR_DISABLED`. Uses inline `CmdLine@2` — no custom task. Updated ARCHITECTURE.md sections 4 and 5.

## D17: Deployment Guide Created
**Date:** 2026-03-03 | **Author:** Keaton | **Status:** Proposed
Created `DEPLOYMENT.md` — 8-phase step-by-step deployment guide (Prerequisites → Build → Publish → Install → PAT Config → Test Verify → Failure Test → Updates). Includes troubleshooting section with 10 common issues. Two PATs needed: Azure DevOps (Marketplace publishing) and GitHub (Copilot CLI). Separated from ARCHITECTURE.md per separation of concerns. Updated ARCHITECTURE.md Section 11 with link.
