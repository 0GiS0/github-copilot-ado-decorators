# GitHub Copilot Pipeline Failure Analyzer

An Azure DevOps extension that automatically analyzes pipeline failures using [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot) and provides AI-powered root cause analysis with actionable fix suggestions — directly in your Pipeline Run Summary.

The extension installs a **pipeline decorator** that injects a post-job step into every pipeline. When a job **fails**, the step collects logs from the failed tasks, sends them to GitHub Copilot for analysis, and displays the results as a Markdown summary in the pipeline run. When jobs succeed, the step is skipped entirely — zero overhead.

> **Note:** Pipeline decorators can only be deployed as **private extensions**. This is a Microsoft platform constraint. The extension must be shared privately with each Azure DevOps organization that needs it.

---

## How It Works

```
Pipeline job fails
       │
       ▼
Decorator injects post-job step (condition: failed())
       │
       ▼
Reads GitHub PAT from service connection
       │
       ▼
Collects failed task logs via Azure DevOps REST API
       │
       ▼
Sends logs to GitHub Copilot CLI for analysis
       │
       ▼
Displays results in Pipeline Run Summary + step output
```

1. The decorator runs as a **post-job step** on every agent job.
2. On failure, it fetches the timeline for the current build and identifies failed tasks.
3. It collects the last N lines of each failed task's log (configurable, default 150).
4. A prompt with CI/CD context and logs is sent to `npx @github/copilot -sp`.
5. Copilot's analysis (root cause, details, suggested fix) appears in the **Extensions tab** of the Pipeline Run Summary and in the step's stdout.
6. The analysis step **never fails your pipeline** — all errors are caught and reported as warnings.

---

## Prerequisites

- **Azure DevOps organization** with admin permissions to install extensions and create service connections
- **GitHub account** with an active **GitHub Copilot** license (Individual, Business, or Enterprise)
- **GitHub Personal Access Token (PAT)** from a Copilot-licensed account
- **Node.js** available on the build agent (Microsoft-hosted agents include it by default)

---

## Installation

### 1. Install the Extension

Since this is a private extension, it must be shared with your Azure DevOps organization before installation.

- If you have the `.vsix` package, publish and share it using:
  ```bash
  tfx extension publish \
    --manifest-globs azure-devops-extension.json \
    --share-with <your-ado-org-name> \
    --token <your-marketplace-pat>
  ```
- Then go to your Azure DevOps organization → **Organization Settings** → **Extensions** → **Shared** tab → click **Install** on the extension.

For full build and deployment steps, see [DEPLOYMENT.md](DEPLOYMENT.md).

### 2. Create the Service Connection

1. In your Azure DevOps project, go to **Project Settings** → **Service connections**.
2. Click **New service connection** → select **Generic** (ExternalServer).
3. Fill in:
   - **Connection name:** `GitHub Copilot CLI Decorator` *(must match exactly)*
   - **Server URL:** `https://github.com` *(or any valid URL — the task only uses the credential)*
   - **Password/Token Key:** Paste your **GitHub PAT** (from a Copilot-licensed account)
4. Check **"Grant access permission to all pipelines"** — this is critical because the decorator injects into all pipelines.
5. Click **Save**.

> **Important:** The service connection name must be exactly `GitHub Copilot CLI Decorator`. The decorator references this name to retrieve the PAT at runtime.

---

## Configuration

### Service Connection (Required)

The extension requires a Generic service connection named **"GitHub Copilot CLI Decorator"** in each project where you want Copilot analysis. The GitHub PAT stored in this connection must belong to an account with an active GitHub Copilot license.

### Opt-Out (Optional)

To disable Copilot analysis for a specific pipeline, set the pipeline variable:

```yaml
variables:
  COPILOT_ANALYSIS_DISABLED: 'true'
```

When this variable is set to `true`, the analysis step is skipped entirely.

### Task Inputs (Optional)

The decorator injects the `CopilotFailureAnalysis` task with sensible defaults. These inputs can be customized if needed:

| Input | Default | Description |
|---|---|---|
| `maxLogLines` | `150` | Maximum number of log lines to collect from each failed step (taken from the end of the log). |
| `copilotNpxTimeout` | `120` | Maximum time in seconds to wait for the Copilot CLI to respond. |

---

## What You'll See

When a pipeline job fails and the analysis completes, you'll find the results in two places:

### Pipeline Run Summary (Extensions Tab)

Navigate to the pipeline run → click the **Extensions** tab. You'll see a Markdown summary with:

- **Root Cause** — A concise summary of why the pipeline failed
- **Details** — Detailed analysis of the error
- **Suggested Fix** — Specific, actionable steps to resolve the issue
- **Related Documentation** — Links to relevant docs (when available)

### Step Output

The same analysis is also printed in the step's stdout. Expand the **"🤖 Copilot Failure Analysis"** step in the job logs to see the full output.

---

## Architecture

The extension is built with TypeScript and Node.js, using the Azure Pipelines Task SDK. It consists of these core modules:

| Module | Purpose |
|---|---|
| `config.ts` | Reads task inputs, service connection credentials, and pipeline variables |
| `log-collector.ts` | Fetches failed task logs via the Azure DevOps REST API |
| `prompt-builder.ts` | Constructs the analysis prompt with CI/CD context and logs |
| `ai-analyzer.ts` | Invokes Copilot CLI via `npx @github/copilot -sp` |
| `output-formatter.ts` | Formats results and uploads the Pipeline Run Summary |
| `index.ts` | Orchestrates the full analysis flow |

The decorator YAML (`decorator/copilot-failure-analysis.yml`) injects the task as a post-job step with `condition: and(failed(), ne(variables['COPILOT_ANALYSIS_DISABLED'], 'true'))`.

For the complete architecture document, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Copilot analysis skipped — service connection not configured" | The service connection is missing or not accessible to the pipeline. | Create a Generic service connection named exactly `GitHub Copilot CLI Decorator` and enable "Grant access permission to all pipelines". |
| "Copilot CLI timed out" | The Copilot CLI took longer than the configured timeout. | Increase `copilotNpxTimeout` or check network connectivity on the agent. |
| "npx command not found" | Node.js / npm is not available on the build agent. | Ensure Node.js is installed on the agent. Microsoft-hosted agents include it by default. |
| Analysis step doesn't appear at all | The decorator may not be installed, or the job didn't fail. | Verify the extension is installed in your organization. The step only runs on failure. |
| "No failed tasks found" | The timeline API returned no failed task records. | Check that `System.AccessToken` has read permissions for the build. This is typically automatic. |
| Analysis is empty or unhelpful | Logs may be too short or the failure is in infrastructure. | Increase `maxLogLines` to send more context to Copilot. |

For additional troubleshooting, see the [Troubleshooting section in DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting).

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and ensure tests pass (`npm test`)
4. Commit your changes (`git commit -m 'feat: add my feature'`)
5. Push to the branch (`git push origin feature/my-feature`)
6. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Package the dev extension
npm run package-extension:dev
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
