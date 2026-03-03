# D2-SC: PAT Authentication — Service Connection (SUPERSEDES D2, D2-R)

**Date:** 2026-03-03  
**Author:** Keaton  
**Status:** Proposed  
**Supersedes:** D2 (Variable Group `CopilotFailureAnalysis`), D2-R (GITHUB_TOKEN from pipeline variable)  
**Requested by:** Gisela Torres

---

## Context

The organization now has a **shared service connection** across all repos called **"GitHub Copilot CLI Decorator"**. This service connection is of type **Generic (ExternalServer)** and stores the GitHub PAT that the Copilot CLI needs to authenticate.

This replaces the previous approaches:
- **D2:** Variable Group `CopilotFailureAnalysis` with secret variable `COPILOT_GITHUB_PAT`
- **D2-R:** Setting `GITHUB_TOKEN` env var from `$(COPILOT_GITHUB_PAT)` pipeline variable

## Decision

Use the **Azure DevOps service connection** named **"GitHub Copilot CLI Decorator"** (type: Generic / `ExternalServer`) to store and provide the GitHub PAT for Copilot CLI authentication.

## How It Works

### 1. Service Connection Setup (Org-Level)

- **Name:** `GitHub Copilot CLI Decorator`
- **Type:** Generic (ExternalServer)
- **Server URL:** `https://github.com` (or any placeholder — the URL is not used directly)
- **Password/Token:** The GitHub PAT with active Copilot license
- **"Grant access permission to all pipelines"** must be **enabled** so the decorator (which injects into all pipelines) can access the service connection without per-pipeline authorization

### 2. Task Definition (`task.json`)

The task manifest declares a `connectedService:ExternalServer` input:

```json
{
    "inputs": [
        {
            "name": "connectedServiceName",
            "type": "connectedService:ExternalServer",
            "label": "GitHub Copilot Service Connection",
            "required": true,
            "helpMarkDown": "Service connection containing the GitHub PAT for Copilot CLI authentication."
        }
    ]
}
```

### 3. Decorator YAML Template

The decorator passes the service connection name as a task input (not as an env var):

```yaml
steps:
  - task: CopilotFailureAnalysis@0
    condition: and(failed(), ne(variables['COPILOT_ANALYSIS_DISABLED'], 'true'))
    displayName: '🤖 Copilot Failure Analysis'
    inputs:
      connectedServiceName: 'GitHub Copilot CLI Decorator'
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

Key changes from D2/D2-R:
- **No more `env: GITHUB_TOKEN: $(COPILOT_GITHUB_PAT)`** — PAT is read from the service connection inside the task
- **`SYSTEM_ACCESSTOKEN`** still comes from `$(System.AccessToken)` as an env var (unchanged)
- The service connection name is passed as a task `input`, not an environment variable

### 4. TypeScript Code (`ai-analyzer.ts`)

The task reads the PAT from the service connection using the ADO Task Lib:

```typescript
import * as tl from 'azure-pipelines-task-lib/task';

const connectedServiceName = tl.getInput('connectedServiceName', true)!;
const githubPat = tl.getEndpointAuthorizationParameter(
    connectedServiceName,
    'password',
    false  // required
)!;

// Set as secret so it's masked in logs
tl.setSecret(githubPat);

// Pass to Copilot CLI via child process env
const result = execFile('npx', ['@github/copilot', '-sp', prompt], {
    env: { ...process.env, GITHUB_TOKEN: githubPat },
    timeout: 120_000,
});
```

### 5. `SYSTEM_ACCESSTOKEN`

`SYSTEM_ACCESSTOKEN` continues to be passed as an environment variable via `$(System.AccessToken)`. This is the standard ADO pattern — the system access token is not a service connection; it's an auto-provided pipeline token.

## Rationale

| Criterion | Variable Group (D2) | Service Connection (D2-SC) |
|---|---|---|
| Scope | Project-level, must link per pipeline | Org-wide, "Grant access to all pipelines" |
| Decorator compatibility | Requires each pipeline to link the variable group | Works seamlessly — decorator injects the input automatically |
| Security | Secret variable, masked in logs | Service connection auth, masked in logs, managed by ADO |
| Admin overhead | Create var group + link to each pipeline | Create once, enable "all pipelines" — done |
| ADO native pattern | Variable groups are for pipeline-scoped config | Service connections are the ADO pattern for external credentials |
| Task SDK support | Read via `process.env` or `tl.getVariable()` | Read via `tl.getEndpointAuthorizationParameter()` |

**The service connection approach is superior** because:
1. It's the ADO-native pattern for external service credentials
2. "Grant access to all pipelines" means zero per-pipeline configuration — critical for a decorator that injects into ALL pipelines
3. No need for each pipeline to link a variable group
4. The ADO Task SDK provides `getEndpointAuthorizationParameter()` specifically for this purpose

## Impact

- **ARCHITECTURE.md:** Section 3.2 rewritten, Section 5 task.json and decorator YAML updated, Section 6.3 ai-analyzer.ts updated
- **DEPLOYMENT.md:** Phase E rewritten from Variable Group to Service Connection setup
- **task.json:** New `connectedServiceName` input of type `connectedService:ExternalServer`
- **decorator YAML:** `inputs:` block replaces `env: GITHUB_TOKEN`
- **ai-analyzer.ts:** Uses `tl.getEndpointAuthorizationParameter()` instead of `process.env.GITHUB_TOKEN`
- **No change to `SYSTEM_ACCESSTOKEN`** — still passed as env var from `$(System.AccessToken)`

## Open Question

- Q9: Does the Generic service connection's "Grant access to all pipelines" actually apply to decorator-injected task inputs, or does it only apply to tasks explicitly defined in the pipeline YAML? → Validate during Phase 1 testing.
