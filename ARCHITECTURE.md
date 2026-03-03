# Architecture — GitHub Copilot Pipeline Failure Analyzer

> Azure DevOps Extension using Pipeline Decorators  
> Author: Keaton (Lead) — 2026-03-03  
> Revised: 2026-03-03 — Copilot CLI approach (replaces direct API)

---

## 1. Overview

This extension installs an **Azure DevOps pipeline decorator** that automatically injects a diagnostic step into every pipeline job. When a pipeline **fails**, this step:

1. Collects logs from the failed tasks via the Azure DevOps REST API
2. Sends the logs to the **GitHub Copilot CLI** (`@github/copilot`) for root cause analysis
3. Displays fix suggestions as a **Pipeline Run Summary** (Markdown) and in the step output

The extension is entirely server-side — no UI hub pages are required (v1). Authentication to the Copilot CLI uses a GitHub PAT (with Copilot license) stored as an organization-level pipeline variable and exposed as `GITHUB_TOKEN`.

---

## 2. High-Level Flow

```
Pipeline Job Fails
       │
       ▼
┌──────────────────────────────────────────────┐
│  Decorator injects post-job step             │
│  condition: failed()                         │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 1: Validate PAT availability           │
│  - Check $(COPILOT_GITHUB_PAT) is set       │
│  - If missing, log warning and exit cleanly  │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 2: Collect failed task logs            │
│  - GET timeline (build/{id}/timeline)        │
│  - Filter: result == "failed"               │
│  - GET individual step logs                  │
│  - Truncate to last ~200 lines per step      │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 3: Ensure Copilot CLI available        │
│  - Check if `copilot` is on PATH            │
│  - If not, use npx @github/copilot          │
│  - Set GITHUB_TOKEN from COPILOT_GITHUB_PAT │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 4: Run Copilot CLI analysis            │
│  - Build prompt (CI/CD context + logs)       │
│  - Execute: npx @github/copilot -sp "prompt"│
│  - Capture stdout as analysis result         │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 5: Display results                     │
│  - Write Markdown to temp file               │
│  - ##vso[task.uploadsummary] → Run Summary   │
│  - Also print to stdout (step output)        │
└──────────────────────────────────────────────┘
```

---

## 3. Design Decisions

### 3.1 AI Model Integration: Copilot CLI (`@github/copilot`)

| Criterion | Direct API (curl/node) | Copilot CLI (`@github/copilot`) |
|---|---|---|
| Installation | None (curl available everywhere) | `npx @github/copilot` — zero install, on-demand |
| Auth | PAT with `models:read` scope | PAT with Copilot license, via `GITHUB_TOKEN` env var |
| Prompt control | Full control over system+user prompt | Arbitrary prompts via `-p` flag |
| Capabilities | Raw model call only | Agentic: tool use, code analysis, Copilot-specific routing |
| Response parsing | JSON — easy to extract | Plain text via `-sp` (silent mode) — clean output |
| Cross-platform | curl works on all agents | npm/npx works on all agents (Node.js present) |
| Speed | Fast (single HTTP call) | Slightly slower (npx resolution + call) |
| Maintenance | Must manage endpoints, models, prompt formats | Copilot handles model routing, prompt optimization |

**Decision: Use the GitHub Copilot CLI via `npx @github/copilot -sp`.**

Rationale:
- The **new standalone `copilot` CLI** (npm package `@github/copilot`) is NOT the old `gh copilot` extension. It's a lightweight, agentic CLI tool installable via npm.
- Using `npx @github/copilot -sp "prompt"` provides **zero-install, on-demand execution** — npx downloads and caches the package automatically. No global install needed, no 100 MB binary, no cross-platform binary management.
- The `-sp` (silent prompt) flag outputs **only Copilot's response** with no usage info or chrome — perfect for script/CI consumption.
- Copilot handles model routing, prompt optimization, and agentic capabilities — we get access to frontier models without managing API endpoints or model names.
- Node.js is guaranteed on ADO agents for task execution, so `npx` is always available.
- Gisela's explicit direction: use Copilot CLI, keep it simple.

**Node.js version consideration:** The `@github/copilot` package requires Node.js 22+. ADO agent task runners use Node.js 20. However, `npx` can download and execute the package using the system's Node.js installation, which on Microsoft-hosted agents is typically Node.js 20 LTS. If the CLI strictly requires Node.js 22+, the task can install Node.js 22 via the `NodeTool@0` task or use a pre-job step. This is a runtime concern to validate during Phase 1 testing.

**Fallback consideration:** If the Copilot CLI is unavailable or fails, the step exits cleanly with a warning. A Phase 2 enhancement could fall back to direct GitHub Models API calls.

### 3.2 PAT Storage: Organization-Level Pipeline Variable

**Options evaluated:**

| Option | Pros | Cons |
|---|---|---|
| Extension Data Service + Settings Hub | Clean UX, org-scoped | Requires hub UI contribution, REST call to fetch at runtime, adds complexity |
| Service Endpoint (Service Connection) | Native ADO pattern, secure | Project-scoped (not org-wide), decorator can't reference endpoints directly |
| Pipeline Variable Group | Simple, familiar | Must be linked to each pipeline manually — doesn't scale for org-wide |
| Organization-level pipeline variable | Simple, org-wide, works with decorators | Requires admin CLI/API to set, not as discoverable |

**Decision: Organization-level pipeline variable** named `COPILOT_GITHUB_PAT`.

How it works:
1. Org admin creates a **Variable Group** named `CopilotFailureAnalysis` in the ADO Library.
2. The variable group contains a **secret variable** `COPILOT_GITHUB_PAT` — a GitHub PAT from an account with an active **Copilot license**.
3. Pipelines that want Copilot analysis **link this variable group** (can be done globally via pipeline templates or per-pipeline).
4. The decorator step sets `GITHUB_TOKEN` from `COPILOT_GITHUB_PAT` so the Copilot CLI picks it up automatically.
5. If `$(COPILOT_GITHUB_PAT)` is not set, the step logs "Copilot analysis skipped — PAT not configured" and exits cleanly (exit 0).

**PAT requirements:**
- The GitHub PAT must be from an account/org with an active **GitHub Copilot** license (Individual, Business, or Enterprise).
- The Copilot CLI authenticates via the `GITHUB_TOKEN` environment variable (standard GitHub authentication pattern, also supported as `GH_TOKEN`).
- No special PAT scope like `models:read` is needed — the Copilot license on the account is what grants access.

**Why not Extension Data Service (v1)?** Adding a settings hub contribution requires the Extension SDK, React UI, webpack bundling, and a REST call at runtime to fetch the PAT. This is significant complexity for v1. The variable group approach is simple, secure (secret variables are encrypted), and familiar to ADO administrators.

**v2 enhancement:** Add a lightweight settings hub where admins paste the PAT, stored via Extension Data Service. The task first checks for the variable, then falls back to Extension Data Service.

### 3.3 Log Collection Strategy

The decorator step has access to:
- `$(System.AccessToken)` — OAuth token for ADO REST API (auto-available in all pipelines)
- `$(System.TeamFoundationCollectionUri)` — Organization URL
- `$(System.TeamProject)` — Project name
- `$(Build.BuildId)` — Current build/run ID

**Log collection algorithm:**

```
1. GET {orgUrl}/{project}/_apis/build/builds/{buildId}/timeline?api-version=7.1
   → Returns all timeline records (steps/tasks with their status)

2. Filter timeline records where:
   - result == "failed"
   - type == "Task"
   → Get the logId for each failed task

3. For each failed task:
   GET {orgUrl}/{project}/_apis/build/builds/{buildId}/logs/{logId}?api-version=7.1
   → Returns the full log text

4. Truncation strategy:
   - Keep the LAST 150 lines of each failed step log (errors are at the end)
   - If total context exceeds ~12,000 tokens (~48KB), prioritize:
     a. The last failed step (most relevant)
     b. Error lines (grep for "error", "Error", "FAILED", "exception")
     c. The last N lines overall

5. Construct prompt context:
   - Pipeline name: $(Build.DefinitionName)
   - Run number: $(Build.BuildNumber)
   - Branch: $(Build.SourceBranch)
   - Agent OS: $(Agent.OS)
   - Failed step name + log excerpt (per step)
```

### 3.4 AI Prompt Design

The prompt is passed to the Copilot CLI via `-sp` (silent prompt). Since the Copilot CLI handles system/model behavior internally, we provide a single combined prompt that includes the analyst persona and the pipeline context.

**Prompt template:**
```
You are a CI/CD pipeline failure analyst. Analyze the following Azure DevOps pipeline
failure logs and provide root cause analysis with fix suggestions. Be concise and actionable.

Format your response as:
## Root Cause
<1-3 sentence summary of why the pipeline failed>

## Details
<Detailed analysis of the error>

## Suggested Fix
<Specific, actionable steps to fix the issue>

## Related Documentation
<Links to relevant docs if applicable>

---

Pipeline "${pipelineName}" failed on branch ${branch} (Agent OS: ${agentOS}).

Failed step(s):

### Step: ${stepName}
```
${logExcerpt}
```

Analyze the failure and provide root cause + fix suggestions.
```

**Prompt construction notes:**
- The Copilot CLI has its own context and capabilities — we don't need to manage model selection, temperature, or token limits
- The prompt is passed as a single string to `copilot -sp`
- Log content is embedded directly in the prompt string (pipe via stdin is also an option for very large logs)
- Truncation is still important to stay within reasonable prompt sizes

### 3.5 Output Display

**Primary: Pipeline Run Summary (Markdown)**
- Write the AI analysis as a Markdown file to `$(Agent.TempDirectory)/copilot-analysis.md`
- Use `##vso[task.uploadsummary]$(Agent.TempDirectory)/copilot-analysis.md` to attach it to the pipeline run
- This appears in the **Extensions** tab of the pipeline run — visible to all team members

**Secondary: Step output (stdout)**
- Also print the analysis to stdout so it appears in the step logs
- Useful for quick viewing without navigating to the Extensions tab

**Considered and deferred:**
- Custom pipeline tab (requires hub contribution — too complex for v1)
- Pipeline artifact upload (overkill for a text report)

### 3.6 Decorator Targeting

**Decision: All pipeline jobs, with condition `failed()`.**

The decorator targets `ms.azure-pipelines-agent-job.post-job-tasks` — the official target for injecting steps that run after all other steps in an agent job. The contribution type is `ms.azure-pipelines.pipeline-decorator` (the single type for all pipeline decorators). The injected step has `condition: failed()`, so it only executes when the job has at least one failed step.

**Available decorator targets (from official docs):**

| Target | When it runs |
|---|---|
| `ms.azure-pipelines-agent-job.pre-job-tasks` | Before any job steps |
| `ms.azure-pipelines-agent-job.post-checkout-tasks` | After checkout |
| `ms.azure-pipelines-agent-job.post-job-tasks` | After all job steps ← **our target** |
| `ms.azure-pipelines-agent-job.pre-task-tasks` | Before a specific task |
| `ms.azure-pipelines-agent-job.post-task-tasks` | After a specific task |

Equivalent targets exist for release pipelines (`ms.azure-release-pipelines-agent-job.*`).

**Opt-out mechanism:** Pipelines can opt out by setting a variable `COPILOT_ANALYSIS_DISABLED: true`. The step checks this variable and skips execution if set.

**Why all pipelines?** The decorator only injects a post-job step — it has zero cost on successful pipelines (the step is skipped due to the `failed()` condition). The only "cost" is the step appearing in the job definition, which is negligible.

### 3.9 Private Extension Requirement

**Only private extensions can contribute pipeline decorators.** Per Microsoft's official documentation, pipeline decorator contributions are restricted to private extensions. The extension:

- **Cannot** be published to the public Visual Studio Marketplace
- **Must** be authored and shared privately with specific Azure DevOps organizations
- Is uploaded via `tfx extension publish` (or create + share) and then shared with the target organization(s)

This is a platform constraint, not a design choice. Organizations that want to use pipeline decorators must install the extension via private sharing.

### 3.7 Task vs. Inline Script

**Decision: Custom build task (TypeScript/Node.js).**

Rationale:
- The logic is moderately complex: multiple API calls, JSON parsing, prompt construction, error handling, Markdown generation
- Node.js is guaranteed on all ADO agents (required for task execution)
- TypeScript provides type safety and better maintainability
- Custom tasks support versioning, which is important for extension updates
- Easier to unit test than inline bash scripts

The decorator YAML template references this task directly. Since the task is bundled in the same extension, it's installed automatically.

### 3.8 Cross-Platform Support

ADO agents run on Linux, Windows, and macOS. The custom task runs on Node.js, which is cross-platform. No platform-specific logic is needed since:
- `npx @github/copilot` works on all platforms where Node.js/npm is installed
- Node.js `child_process` module for spawning the CLI is cross-platform
- File system operations use `path` module for cross-platform paths
- The `azure-pipelines-task-lib` handles platform differences

---

## 4. Project Structure

```
github-copilot-ado-decorators/
│
├── ARCHITECTURE.md                          # This document
├── README.md                                # User-facing documentation
├── overview.md                              # Marketplace listing description
├── logo.png                                 # Extension icon (128x128)
│
├── vss-extension.json                       # Production extension manifest
├── vss-extension.dev.json                   # Dev manifest (for testing)
├── package.json                             # Node.js project config
├── tsconfig.json                            # TypeScript config
├── .gitignore
│
├── decorator/
│   ├── copilot-failure-analysis.yml         # Decorator YAML template (failure analysis)
│   └── test-decorator.yml                   # Test/verification decorator (proves injection works)
│
├── src/
│   └── copilot-failure-analysis-task/       # Custom task implementation
│       ├── task.json                        # Task manifest (name, version, inputs)
│       ├── index.ts                         # Task entry point
│       ├── log-collector.ts                 # ADO REST API log collection
│       ├── ai-analyzer.ts                   # Copilot CLI invocation (npx @github/copilot)
│       ├── prompt-builder.ts                # Prompt construction + truncation
│       ├── output-formatter.ts              # Markdown generation + summary upload
│       └── config.ts                        # Configuration constants and defaults
│
├── tests/
│   ├── log-collector.test.ts                # Unit tests for log collection
│   ├── ai-analyzer.test.ts                  # Unit tests for AI integration
│   ├── prompt-builder.test.ts               # Unit tests for prompt construction
│   ├── output-formatter.test.ts             # Unit tests for output formatting
│   └── fixtures/                            # Test data
│       ├── timeline-response.json           # Sample ADO timeline API response
│       ├── log-response.txt                 # Sample step log
│       └── copilot-response.txt             # Sample Copilot CLI output
│
├── scripts/
│   ├── package.sh                           # Build + package extension (tfx)
│   └── publish.sh                           # Publish to marketplace
│
└── .github/
    └── workflows/
        └── ci.yml                           # CI/CD for the extension itself
```

### Key Files Explained

| File | Purpose |
|---|---|
| `vss-extension.json` | Extension manifest — defines the decorator contribution, task, scopes, and metadata |
| `decorator/copilot-failure-analysis.yml` | YAML template injected by the decorator — references the custom task |
| `decorator/test-decorator.yml` | Test/verification decorator — prints confirmation message when `COPILOT_TEST_MODE` is set |
| `src/copilot-failure-analysis-task/task.json` | Task definition — inputs, execution handler, version |
| `src/copilot-failure-analysis-task/index.ts` | Entry point — orchestrates log collection → AI analysis → output |

---

## 5. Extension Manifest Design

### vss-extension.json

```jsonc
{
    "manifestVersion": 1,
    "id": "copilot-failure-analysis",
    "publisher": "returngisorg",
    "version": "0.1.0",
    "name": "GitHub Copilot Pipeline Failure Analyzer",
    "description": "Automatically analyzes pipeline failures using AI and provides root cause analysis with fix suggestions.",
    "categories": ["Azure Pipelines"],
    "targets": [
        { "id": "Microsoft.VisualStudio.Services" }
    ],
    "scopes": [],
    "icons": {
        "default": "logo.png"
    },
    "content": {
        "details": { "path": "overview.md" }
    },
    "contributions": [
        {
            "id": "copilot-failure-analysis-decorator",
            "type": "ms.azure-pipelines.pipeline-decorator",
            "targets": [
                "ms.azure-pipelines-agent-job.post-job-tasks"
            ],
            "properties": {
                "template": "decorator/copilot-failure-analysis.yml"
            }
        },
        {
            "id": "copilot-test-decorator",
            "type": "ms.azure-pipelines.pipeline-decorator",
            "targets": [
                "ms.azure-pipelines-agent-job.post-job-tasks"
            ],
            "properties": {
                "template": "decorator/test-decorator.yml"
            }
        }
    ],
    "files": [
        {
            "path": "decorator/copilot-failure-analysis.yml",
            "addressable": true,
            "contentType": "text/plain"
        },
        {
            "path": "decorator/test-decorator.yml",
            "addressable": true,
            "contentType": "text/plain"
        },
        {
            "path": "src/copilot-failure-analysis-task",
            "addressable": true,
            "packagePath": "copilot-failure-analysis-task"
        }
    ]
}
```

**Notes:**
- **Private extension only.** Pipeline decorators can only be contributed by private extensions. This extension must be shared privately with target organizations — it cannot be listed on the public marketplace.
- **No scopes needed.** The decorator step uses `System.AccessToken` (auto-provided) for ADO API calls, and the GitHub PAT from a pipeline variable. No extension-specific OAuth scopes are required.
- **Contribution type.** All pipeline decorators use `ms.azure-pipelines.pipeline-decorator` as their contribution `type`, regardless of where they inject (pre-job, post-job, etc.). The `targets` array determines the injection point — we use `ms.azure-pipelines-agent-job.post-job-tasks` to inject after all job steps complete.
- **Post-job injection.** The `post-job-tasks` target ensures the decorator step is injected after all other steps in the job. The `condition: failed()` on the step further limits execution to failures only — the step is always injected but only runs when the job has failures.
- **File entry with contentType.** The decorator YAML file entry must specify the exact file path and `contentType: "text/plain"` per the official docs.
- **Task bundled as file.** The task folder is included in `files` so it ships with the extension.
- **Test decorator contribution.** A second decorator (`copilot-test-decorator`) is registered with the same target. Its YAML template uses a `${{ if }}` compile-time gate on `COPILOT_TEST_MODE`, so it has zero footprint on normal pipelines. It uses an inline `CmdLine@2` script — no custom task required.

### Decorator YAML Template

```yaml
# decorator/copilot-failure-analysis.yml
steps:
  - task: CopilotFailureAnalysis@0
    condition: and(failed(), ne(variables['COPILOT_ANALYSIS_DISABLED'], 'true'))
    displayName: '🤖 Copilot Failure Analysis'
    env:
      GITHUB_TOKEN: $(COPILOT_GITHUB_PAT)
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

### Test/Verification Decorator YAML Template

```yaml
# decorator/test-decorator.yml
steps:
  - ${{ if eq(variables['COPILOT_TEST_MODE'], 'true') }}:
    - task: CmdLine@2
      condition: ne(variables['COPILOT_TEST_DECORATOR_DISABLED'], 'true')
      displayName: '✅ Copilot Extension Test'
      inputs:
        script: |
          echo "✅ Copilot Failure Analysis extension is active"
          echo "   Decorator injection is working correctly."
          echo "   Organization: $(System.TeamFoundationCollectionUri)"
          echo "   Project: $(System.TeamProject)"
          echo "   Pipeline: $(Build.DefinitionName)"
          echo "   Agent: $(Agent.MachineName) ($(Agent.OS))"
```

**Purpose:** A lightweight test decorator to verify the extension is installed and decorator injection is working. Does not perform any analysis — just prints a confirmation message with environment details.

**Activation:**
- Only injected when `COPILOT_TEST_MODE` is set to `true` (compile-time `${{ if }}` gate)
- Without this variable, the step is not injected at all — zero impact on normal pipelines
- Once injected, can be disabled per-pipeline at runtime via `COPILOT_TEST_DECORATOR_DISABLED=true`

**Usage:** Org admins set `COPILOT_TEST_MODE=true` as an organization-level or pipeline-level variable. If the "✅ Copilot Extension Test" step appears in pipeline runs, the extension is correctly installed and decorators are being injected. Remove the variable when verification is complete.

---

**`condition:` vs `${{ if }}` in decorator templates:**

Pipeline decorators support two distinct conditional mechanisms:

| Mechanism | Evaluation time | Use case |
|---|---|---|
| `${{ if ... }}` | **Compile time** (template expansion) | Controls whether the step is _injected_ into the pipeline at all. Can reference `resources.repositories['self'].ref`, task IDs, etc. |
| `condition:` | **Runtime** | Controls whether an already-injected step actually _executes_. Can reference `failed()`, `variables[...]`, etc. |

Our decorator uses `condition:` (runtime) intentionally:
- `failed()` must be evaluated at runtime — it checks whether prior steps failed
- `variables['COPILOT_ANALYSIS_DISABLED']` is a runtime variable — not available at template expansion time
- The step is always injected (no `${{ if }}` gate) but only runs when the job has failures and the opt-out variable is not set

This is correct per the official docs: `${{ if }}` expressions at the template level and `condition:` on steps serve different purposes and can coexist in decorator templates.

### Task Manifest

```jsonc
// src/copilot-failure-analysis-task/task.json
{
    "$schema": "https://raw.githubusercontent.com/Microsoft/azure-pipelines-task-lib/master/tasks.schema.json",
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // Generate unique GUID
    "name": "CopilotFailureAnalysis",
    "friendlyName": "Copilot Failure Analysis",
    "description": "Analyzes pipeline failure logs using AI and provides root cause analysis.",
    "category": "Utility",
    "author": "returngisorg",
    "version": {
        "Major": 0,
        "Minor": 1,
        "Patch": 0
    },
    "instanceNameFormat": "Copilot Failure Analysis",
    "execution": {
        "Node20_1": {
            "target": "index.js"
        }
    },
    "inputs": [
        {
            "name": "maxLogLines",
            "type": "string",
            "label": "Max Log Lines Per Step",
            "defaultValue": "150",
            "required": false,
            "helpMarkDown": "Maximum number of log lines to collect from each failed step (from the end)."
        },
        {
            "name": "copilotNpxTimeout",
            "type": "string",
            "label": "Copilot CLI Timeout (seconds)",
            "defaultValue": "120",
            "required": false,
            "helpMarkDown": "Maximum time in seconds to wait for the Copilot CLI to respond."
        }
    ]
}
```

---

## 6. Module Design

### 6.1 index.ts — Task Entry Point

```typescript
// Orchestration flow:
async function run(): Promise<void> {
    // 1. Read configuration (PAT, build context)
    // 2. Validate PAT is available
    // 3. Collect failed task logs
    // 4. Build prompt with context
    // 5. Run Copilot CLI analysis (npx @github/copilot -sp)
    // 6. Format and display results
}
```

### 6.2 log-collector.ts — ADO REST API Client

Responsibilities:
- Fetch build timeline records
- Filter for failed tasks
- Fetch individual task logs
- Truncate logs to configured max lines

Key types:
```typescript
interface TimelineRecord {
    id: string;
    name: string;
    type: string;        // "Task", "Job", "Stage"
    result: string;      // "succeeded", "failed", "canceled"
    log?: { id: number; url: string };
    issues?: Array<{ type: string; message: string }>;
}

interface FailedStepLog {
    stepName: string;
    logContent: string;   // Truncated log text
    issues: string[];     // Error/warning messages from timeline
}
```

### 6.3 ai-analyzer.ts — Copilot CLI Client

Responsibilities:
- Execute `npx @github/copilot -sp "prompt"` via `child_process.execFile`
- Set `GITHUB_TOKEN` in the child process environment
- Handle process exit codes and timeouts
- Capture stdout as the analysis result
- Handle errors (CLI not found, auth failure, timeout)

```typescript
interface AnalysisResult {
    analysisText: string;   // Raw Copilot response (Markdown)
    success: boolean;
    errorMessage?: string;
}

// Implementation approach:
async function analyzeLogs(prompt: string, config: TaskConfig): Promise<AnalysisResult> {
    // 1. Spawn: npx @github/copilot -sp "prompt"
    //    - env: { ...process.env, GITHUB_TOKEN: config.githubPat }
    //    - timeout: config.copilotTimeout (default 120s)
    // 2. Capture stdout
    // 3. If exit code !== 0, return { success: false, errorMessage }
    // 4. Return { analysisText: stdout, success: true }
}
```

**Why `npx` instead of global install?**
- `npx @github/copilot` downloads, caches, and runs the package on demand
- No global install step, no cleanup, no version conflicts
- npx caches the package after first download — subsequent runs are fast
- Works identically on all platforms with Node.js/npm

### 6.4 prompt-builder.ts — Prompt Engineering

Responsibilities:
- Build the combined prompt (analyst persona + pipeline context + logs)
- Enforce prompt size limits by truncating logs intelligently
- Prioritize error lines when truncating
- Escape special characters for safe shell invocation

### 6.5 output-formatter.ts — Results Display

Responsibilities:
- Format the AI response as Markdown
- Write to temp file
- Use `##vso[task.uploadsummary]` to attach as pipeline run summary
- Also write to stdout

### 6.6 config.ts — Configuration

```typescript
interface TaskConfig {
    githubPat: string;
    adoToken: string;
    orgUrl: string;
    project: string;
    buildId: number;
    pipelineName: string;
    buildNumber: string;
    sourceBranch: string;
    agentOS: string;
    maxLogLines: number;
    copilotTimeout: number;     // Seconds to wait for Copilot CLI response
}
```

---

## 7. Copilot CLI Invocation & API Contracts

### 7.1 Copilot CLI Invocation

```bash
# Silent prompt mode — outputs only Copilot's response
npx @github/copilot -sp "Your prompt here"
```

**Environment:**
```bash
GITHUB_TOKEN={COPILOT_GITHUB_PAT}   # Required — Copilot CLI reads this for auth
```

**Flags:**
| Flag | Purpose |
|---|---|
| `-p "prompt"` | Non-interactive mode — single prompt, returns response |
| `-sp "prompt"` | Silent prompt — only outputs Copilot's response (no usage info) |
| `-s` | Silent mode modifier — suppresses non-response output |

**Authentication flow in CI:**
1. The decorator YAML sets `GITHUB_TOKEN` from `$(COPILOT_GITHUB_PAT)`
2. The task passes `GITHUB_TOKEN` in the child process environment
3. The Copilot CLI reads `GITHUB_TOKEN` for authentication (standard GitHub auth pattern)
4. The PAT must be from an account with an active Copilot license

**Alternative auth env vars:** The CLI likely also supports `GH_TOKEN` (GitHub CLI convention). We use `GITHUB_TOKEN` as it's the most standard.

**Node.js execution:**
```typescript
import { execFile } from 'child_process';

const result = await new Promise<string>((resolve, reject) => {
    execFile('npx', ['@github/copilot', '-sp', prompt], {
        env: { ...process.env, GITHUB_TOKEN: pat },
        timeout: 120_000,  // 2 minutes
        maxBuffer: 1024 * 1024,  // 1 MB output buffer
    }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
    });
});
```

### 7.2 ADO Timeline API

```http
GET {orgUrl}/{project}/_apis/build/builds/{buildId}/timeline?api-version=7.1
Authorization: Bearer {System.AccessToken}
```

### 7.3 ADO Build Log API

```http
GET {orgUrl}/{project}/_apis/build/builds/{buildId}/logs/{logId}?api-version=7.1
Authorization: Bearer {System.AccessToken}
```

---

## 8. Error Handling

| Scenario | Handling |
|---|---|
| `COPILOT_GITHUB_PAT` not set | Log warning, exit 0 (don't fail the pipeline further) |
| ADO API call fails | Log error with HTTP status, exit 0 |
| `npx @github/copilot` not found / fails to install | Log error ("Copilot CLI unavailable"), exit 0 |
| Copilot CLI auth failure (invalid PAT / no Copilot license) | Log error with CLI stderr, exit 0 |
| Copilot CLI timeout (exceeds configured timeout) | Kill process, log warning ("analysis timed out"), exit 0 |
| Copilot CLI non-zero exit code | Log error with stderr content, exit 0 |
| No failed steps found in timeline | Log info ("no failed steps found"), exit 0 |
| Log content empty | Log info, skip analysis, exit 0 |
| Copilot response empty | Log warning ("empty response"), exit 0 |

**Critical principle:** The analysis step must NEVER fail the pipeline further. All errors result in exit code 0 with a warning message. Use `task.setResult(TaskResult.SucceededWithIssues)` for non-critical warnings.

### 8.1 Debugging Decorator Injection

The Azure DevOps agent supports a built-in debug variable for decorators:

- Set `system.debugContext` to `true` in the pipeline to see the decorator context at runtime
- This reveals the template expansion context, which targets matched, and what expressions were evaluated
- Useful for troubleshooting when the decorator step is not being injected as expected or when `${{ if }}` conditions are behaving unexpectedly

```yaml
variables:
  system.debugContext: true
```

---

## 9. Security Considerations

1. **GitHub PAT as secret variable:** The PAT is stored as a secret in the variable group. ADO masks secret values in logs. The task must not log the PAT (use `task.setSecret()`).

2. **System.AccessToken scope:** The auto-provided token has read access to build logs by default. No additional configuration needed.

3. **Log content to Copilot:** Pipeline logs are sent to the GitHub Copilot service via the CLI. Organizations should be aware that log content leaves the ADO boundary and is processed by GitHub Copilot. Document this clearly. Organizations with data residency requirements should evaluate this.

4. **No data persistence:** The extension does not store any data. Analysis results are ephemeral (pipeline run summary + step output).

5. **npx security:** Using `npx @github/copilot` downloads the package from npm. The `@github` scope is verified/owned by GitHub, reducing supply chain risk. The package is cached locally after first download.

---

## 10. Dependencies

### Runtime (bundled with task)
```json
{
    "azure-pipelines-task-lib": "^4.0.0"
}
```

### Runtime (installed on-demand at execution)
```
@github/copilot — installed/cached via npx at runtime, NOT bundled with the extension
```

**Node.js requirements:**
- The ADO task runner uses Node.js 20 (`Node20_1` execution handler)
- The `@github/copilot` CLI requires Node.js 22+
- Since we invoke via `npx` (which uses the system Node.js, not the task runner's Node.js), the agent's system Node.js version matters
- Microsoft-hosted agents: verify Node.js version during Phase 1 testing. If < 22, the task may need to use `NodeTool@0` to install Node.js 22 first, or use an alternative invocation approach
- Self-hosted agents: document Node.js 22+ as a requirement

### Development
```json
{
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/node": "^20.0.0"
}
```

**Minimal dependency philosophy:** The only bundled runtime dependency is `azure-pipelines-task-lib`. The Copilot CLI is fetched on-demand via npx. No external HTTP libraries needed — ADO API calls use Node.js built-in `https` module.

---

## 11. Implementation Phases

### Phase 1 — MVP (Core Flow) 🎯

**Goal:** Working end-to-end decorator that analyzes failed pipelines.

| # | Task | Owner | Depends On |
|---|---|---|---|
| 1.1 | Set up project structure (package.json, tsconfig, vss-extension.json) | McManus | — |
| 1.2 | Create decorator YAML template | McManus | 1.1 |
| 1.3 | Implement task.json and index.ts (entry point) | Verbal | 1.1 |
| 1.4 | Implement log-collector.ts (ADO API integration) | Verbal | 1.3 |
| 1.5 | Implement prompt-builder.ts (prompt construction) | Verbal | 1.3 |
| 1.6 | Implement ai-analyzer.ts (Copilot CLI invocation via npx) | Verbal | 1.3 |
| 1.7 | Implement output-formatter.ts (Markdown + summary) | Verbal | 1.3 |
| 1.8 | Integration: wire all modules in index.ts | Verbal | 1.4–1.7 |
| 1.9 | Unit tests for all modules | Hockney | 1.4–1.7 |
| 1.10 | Package extension with tfx-cli, test on dev org | McManus | 1.8, 1.9 |
| 1.11 | Write README and overview.md | Keaton | 1.8 |

**Estimated effort:** ~3–4 days for a focused team.

### Phase 2 — Polish & Configuration

| # | Task |
|---|---|
| 2.1 | Add configurable Copilot CLI timeout (task input) |
| 2.2 | Add opt-out variable (`COPILOT_ANALYSIS_DISABLED`) |
| 2.3 | Improve log truncation (smart error-line extraction) |
| 2.4 | Add retry logic for Copilot CLI failures |
| 2.5 | CI/CD pipeline for the extension itself |
| 2.6 | Dev manifest for local testing |
| 2.7 | Validate Node.js 22+ availability on Microsoft-hosted agents |

### Phase 3 — Enterprise Features

| # | Task |
|---|---|
| 3.1 | Settings hub for PAT configuration (Extension Data Service) |
| 3.2 | Fallback to direct GitHub Models API if Copilot CLI unavailable |
| 3.3 | Custom prompt templates (configurable prompt prefix) |
| 3.4 | Multi-language analysis (detect log language, respond accordingly) |
| 3.5 | Analysis result caching (don't re-analyze the same failure if pipeline is retried) |

> **📦 Deployment:** For a complete step-by-step guide on packaging, publishing, installing, and configuring this extension in an Azure DevOps organization, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 12. Open Questions

| # | Question | Status |
|---|---|---|
| Q1 | Node.js 22+ on Microsoft-hosted agents — is it available, or do we need `NodeTool@0`? | Must validate in Phase 1 |
| Q2 | Should we support deployment group jobs and container jobs, or only agent jobs? | Agent jobs only for v1 |
| Q3 | Maximum log size to send to the CLI — what's the right balance? | Start with 150 lines/step, tune based on feedback |
| Q4 | Does `copilot` CLI support stdin for prompt input (for very large prompts)? | Research during implementation |
| Q5 | Publisher ID — using `returngisorg` to match existing extension? | Confirm with Gisela |
| Q6 | npx caching behavior on ADO agents — does it persist across pipeline runs? | Microsoft-hosted: no (ephemeral). Self-hosted: yes (cached in npm cache) |
| Q7 | Exact `GITHUB_TOKEN` vs `GH_TOKEN` behavior for Copilot CLI auth in CI? | Validate during Phase 1 |
| Q8 | Private extension sharing workflow — automate via `tfx extension share` in CI? | Define during Phase 1 |
