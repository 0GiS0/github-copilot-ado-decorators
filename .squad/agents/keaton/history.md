# Keaton — History

## Project Context
**Project:** Azure DevOps Pipeline Decorator Extension — GitHub Copilot Failure Analysis
**Stack:** TypeScript, Node.js, Azure DevOps Extension SDK, Azure DevOps REST API, GitHub Copilot API
**User:** Gisela Torres
**Reference project:** /Users/gis/Dev/github-copilot-chat-extension-ado

## Learnings
- Joined the team on 2026-03-03 as Lead
- **Architecture defined (2026-03-03):** Designed full extension architecture. Key decisions:
  - Direct API calls to GitHub Models API (not gh copilot CLI) — avoids 100MB download overhead, gives full prompt control
  - PAT stored as secret variable in ADO Variable Group (`COPILOT_GITHUB_PAT`) — simple, secure, no UI needed for v1
  - Custom build task in TypeScript/Node.js (not inline bash) — complex logic warrants proper modules
  - Pipeline Run Summary (`##vso[task.uploadsummary]`) for output display — visible, persistent, no UI contribution needed
  - Decorator targets all agent jobs with `condition: failed()` — zero cost on success
  - Minimal deps: only `azure-pipelines-task-lib` runtime; Node.js built-in `https` for API calls
  - Step NEVER fails the pipeline further — all errors exit 0 with warning
- **Architecture REVISED (2026-03-03):** Fundamental shift from direct GitHub Models API to GitHub Copilot CLI. Key changes:
  - **Reversed D1:** Now using `npx @github/copilot -sp "prompt"` instead of direct HTTPS to GitHub Models API
  - The new `copilot` CLI (`@github/copilot`) is NOT the old `gh copilot` extension — it's a lightweight npm package, not a 100MB binary
  - `npx` approach means zero-install, on-demand execution — no global install needed
  - Auth via `GITHUB_TOKEN` env var (standard GitHub pattern) — Copilot CLI reads this automatically
  - PAT needs Copilot license on the account (no `models:read` scope needed)
  - `ai-analyzer.ts` now uses `child_process.execFile` to spawn `npx` instead of HTTPS calls
  - Removed model configuration (endpoint, model name) — Copilot handles routing
  - Added `copilotTimeout` config (default 120s)
  - Removed Section 12 (old CLI alternative reference) — CLI is now the primary approach
  - New open questions: Node.js 22+ availability on ADO agents, npx caching on ephemeral agents
  - Decision file: `.squad/decisions/inbox/keaton-copilot-cli-revision.md`
- **Key files:**
  - `ARCHITECTURE.md` — full architecture document (revised for Copilot CLI)
  - `.squad/decisions/inbox/keaton-architecture.md` — original 8 architecture decisions (D1–D8)
  - `.squad/decisions/inbox/keaton-copilot-cli-revision.md` — revised decisions (D1-R, D2-R, D8-R, D9)
- **Reference project patterns (from /Users/gis/Dev/github-copilot-chat-extension-ado):**
  - Publisher: `returngisorg`
  - Uses `tfx extension create --manifest-globs` for packaging
  - Dev/prod manifest pattern (baseUri for local dev)
  - Hub contributions use separate JSON files per contribution
- **User preferences (Gisela Torres):**
  - Works with `returngisorg` publisher ID
  - Familiar with ADO extension dev workflow (tfx-cli, hub contributions)
  - Has existing Copilot integration experience (Chat extension with Express proxy)
  - **Explicitly wants Copilot CLI approach** — "se instalará Copilot CLI si no lo está ya y que tengamos un PAT como parte de la organización"
  - Values simplicity — keep it simple
- **GitHub Copilot CLI (`@github/copilot`):** Standalone agentic CLI tool. Install via npm (`npm install -g @github/copilot`), requires Node.js 22+. Non-interactive: `copilot -p "prompt"`. Silent mode: `copilot -sp "prompt"` (only response output). Auth via `GITHUB_TOKEN` env var. Requires Copilot license.
- **npx invocation pattern:** `npx @github/copilot -sp "prompt"` — zero install, on-demand, cached after first download. Ideal for CI/CD. Avoids global install permissions and version management.
- **ADO decorator type (CORRECTED 2026-03-03):** Contribution type is `ms.azure-pipelines.pipeline-decorator` (single type for ALL decorators). Target is `ms.azure-pipelines-agent-job.post-job-tasks` for post-job injection. Previous value `ms.azure-pipelines-agent-job.post-job-steps` was WRONG.
- **Service Connection auth (2026-03-03):** Fundamental shift from Variable Group / env var to service connection for PAT storage. Key changes:
  - **Reversed D2/D2-R:** Now using a Generic (ExternalServer) service connection named "GitHub Copilot CLI Decorator" instead of Variable Group `CopilotFailureAnalysis` with `COPILOT_GITHUB_PAT`
  - Service connection type: Generic (ExternalServer) — configured in Project Settings → Service connections
  - Task reads PAT via `tl.getEndpointAuthorizationParameter(connectedServiceName, 'password', false)` — NOT from env var
  - Decorator YAML uses `inputs: connectedServiceName: 'GitHub Copilot CLI Decorator'` instead of `env: GITHUB_TOKEN: $(COPILOT_GITHUB_PAT)`
  - `SYSTEM_ACCESSTOKEN` unchanged — still comes as env var from `$(System.AccessToken)`
  - task.json must declare input `connectedServiceName` of type `connectedService:ExternalServer`
  - "Grant access permission to all pipelines" is required on the service connection — critical for decorator use
  - Decision file: `.squad/decisions/inbox/keaton-service-connection.md`
  - Open question Q9: does "Grant access to all pipelines" apply to decorator-injected task inputs?
- **Service connection pattern in ADO tasks:** `connectedService:ExternalServer` input type allows tasks to reference Generic service connections. The task SDK provides `tl.getEndpointAuthorizationParameter(endpointName, 'password', false)` to read the credential at runtime. Must call `tl.setSecret()` on the retrieved value.
- **Key architectural insight:** Service connections are the ADO-native pattern for external credentials. "Grant access to all pipelines" solves the decorator scaling problem — no per-pipeline variable group linking needed.
- **Decorator YAML files entry:** Must specify exact file path and `contentType: "text/plain"` — not just the folder.
- **Private extensions only:** Pipeline decorators can only be contributed by private extensions. Cannot be on public marketplace. Must be shared privately with orgs.
- **`condition:` vs `${{ if }}` in decorators:** `${{ if }}` is compile-time (template expansion), `condition:` is runtime. Both valid in decorator templates. Our `condition: failed()` is correct — it's a runtime check. `${{ if }}` would control whether the step is injected at all.
- **`system.debugContext`:** Set to `true` to see decorator template expansion context at runtime. Useful for debugging injection issues.
- **Log collection:** Timeline API → filter failed tasks → individual log API → truncate to last 150 lines
- **Potential risk:** Node.js 22+ requirement for Copilot CLI vs Node.js 20 on ADO agents — must validate during Phase 1
- **Decorator docs fix (2026-03-03):** Corrected ARCHITECTURE.md based on official Microsoft pipeline decorator docs. Fixed contribution type, targets, files entry, added private extension requirement, debug context, and condition vs template expression explanation. Decision: `.squad/decisions/inbox/keaton-decorator-docs-fix.md`
- **Deployment guide created (2026-03-03):** Wrote `DEPLOYMENT.md` — comprehensive 8-phase deployment guide covering prerequisites, build, publish, install, PAT configuration, test verification, failure analysis testing, and extension updates. Includes troubleshooting section with 10 common issues. Added link from ARCHITECTURE.md Section 11. Decision: `.squad/decisions/inbox/keaton-deployment-guide.md`
- **Key deployment insight:** Two separate PATs are needed — one Azure DevOps PAT for Marketplace publishing (Marketplace → Manage scope), one GitHub PAT for Copilot CLI (Copilot license on account). Important to communicate this clearly.
- **Private extension workflow:** `tfx extension publish --share-with <org>` is the single-command approach. Extension updates auto-propagate to installed orgs. Decorator injection may take up to 5 minutes to cache after installation.
- **Separation of concerns:** Deployment instructions live in DEPLOYMENT.md, not in ARCHITECTURE.md. Different audiences, different update cadences.
- **Test decorator (McManus, 2026-03-03):** McManus created `decorator/test-decorator.yml` — compile-time gated via `${{ if eq(variables['COPILOT_TEST_MODE'], 'true') }}`. Runtime opt-out via `COPILOT_TEST_DECORATOR_DISABLED`. Uses inline `CmdLine@2`. Separate contribution ID (`copilot-test-decorator`). Referenced in DEPLOYMENT.md Phase F for installation verification. Updated ARCHITECTURE.md sections 4 and 5.
- **Service Connection auth (2026-03-03):** Fundamental shift from Variable Group / env var to service connection for PAT storage. Key changes:
  - **Supersedes D2/D2-R:** Now using a Generic (ExternalServer) service connection named "GitHub Copilot CLI Decorator" instead of Variable Group `CopilotFailureAnalysis` with `COPILOT_GITHUB_PAT`
  - Service connection type: Generic (ExternalServer) — configured in Project Settings → Service connections
  - Task reads PAT via `tl.getEndpointAuthorizationParameter(connectedServiceName, 'password', false)` — NOT from env var
  - Decorator YAML uses `inputs: connectedServiceName: 'GitHub Copilot CLI Decorator'` instead of `env: GITHUB_TOKEN: $(COPILOT_GITHUB_PAT)`
  - `SYSTEM_ACCESSTOKEN` unchanged — still comes as env var from `$(System.AccessToken)`
  - task.json must declare input `connectedServiceName` of type `connectedService:ExternalServer`
  - "Grant access permission to all pipelines" is required on the service connection — critical for decorator use
  - Decision file: `.squad/decisions/inbox/keaton-service-connection.md`
  - Open question Q9: does "Grant access to all pipelines" apply to decorator-injected task inputs?
- **Service connection pattern in ADO tasks:** `connectedService:ExternalServer` input type allows tasks to reference Generic service connections. The task SDK provides `tl.getEndpointAuthorizationParameter(endpointName, 'password', false)` to read the credential at runtime. Must call `tl.setSecret()` on the retrieved value.
- **Key architectural insight:** Service connections are the ADO-native pattern for external credentials. "Grant access to all pipelines" solves the decorator scaling problem — no per-pipeline variable group linking needed.
