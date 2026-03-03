# GitHub Copilot Pipeline Failure Analyzer

Automatically analyzes Azure DevOps pipeline failures using GitHub Copilot and provides AI-powered root cause analysis with actionable fix suggestions.

## Features

- **Automatic failure detection** — Runs as a post-job decorator on every pipeline, activating only when a job fails.
- **AI-powered analysis** — Sends pipeline logs to GitHub Copilot for intelligent root cause analysis.
- **Actionable suggestions** — Provides specific fix recommendations directly in the pipeline run summary.
- **Zero configuration** — Installs as a pipeline decorator; no changes to existing pipeline YAML required.
- **Safe by design** — Never fails your pipeline. All analysis errors are handled gracefully.

## How It Works

1. The extension installs a pipeline decorator that runs after every job.
2. When a job fails, the decorator collects the relevant logs.
3. Logs are sent to GitHub Copilot for analysis.
4. The AI-generated analysis appears in the pipeline run summary (Extensions tab).

## Requirements

- Azure DevOps organization with the extension installed
- A Generic service connection named **"GitHub Copilot CLI Decorator"** containing a GitHub PAT with an active Copilot license
- Node.js 22+ available on the build agent

## Getting Started

See [DEPLOYMENT.md](DEPLOYMENT.md) for full installation and configuration instructions.
