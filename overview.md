# GitHub Copilot Pipeline Failure Analyzer

Automatically analyzes Azure DevOps pipeline failures using **GitHub Copilot** and provides AI-powered root cause analysis with actionable fix suggestions — right in your Pipeline Run Summary.

## Key Features

- **Fully automatic** — Installs as a pipeline decorator. No changes to your pipeline YAML. Activates only when a job fails; zero overhead on successful runs.
- **AI-powered root cause analysis** — Sends failed task logs to GitHub Copilot for intelligent analysis including root cause, detailed breakdown, and specific fix recommendations.
- **Results in Pipeline Run Summary** — Analysis appears in the **Extensions tab** of your pipeline run, persistent and accessible to the whole team.
- **Safe by design** — The analysis step never fails your pipeline. All errors are handled gracefully with warnings.
- **Easy opt-out** — Disable for any pipeline by setting `COPILOT_ANALYSIS_DISABLED=true`.

## How It Works

1. The extension installs a **pipeline decorator** that injects a post-job step into every agent job.
2. When a job **fails**, the step collects the relevant logs from the Azure DevOps REST API.
3. Logs are sent to **GitHub Copilot CLI** for root cause analysis.
4. The AI-generated analysis — including root cause, details, and suggested fixes — appears in the **Pipeline Run Summary** (Extensions tab) and in the step output.

## Getting Started

1. **Install the extension** in your Azure DevOps organization (shared privately).
2. **Create a Generic service connection** named `GitHub Copilot CLI Decorator` in Project Settings → Service connections.
3. **Paste your GitHub PAT** (from a Copilot-licensed account) into the Password/Token Key field.
4. **Enable "Grant access permission to all pipelines"** on the service connection.
5. That's it — the next time a pipeline fails, you'll see Copilot's analysis in the run summary.

## Requirements

- Azure DevOps organization with the extension installed
- A Generic service connection named **"GitHub Copilot CLI Decorator"** with a GitHub PAT from a Copilot-licensed account
- Node.js available on the build agent (included on Microsoft-hosted agents)

> **Note:** A logo for the marketplace listing is pending.

For full deployment and configuration details, see the [README](https://github.com/returngis/github-copilot-ado-decorators#readme).
