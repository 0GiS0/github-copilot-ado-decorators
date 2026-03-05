# 🤖 GitHub Copilot Pipeline Failure Analyzer

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Follow-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Follow-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>

---

Hey developer 👋🏻! This is an Azure DevOps extension that automatically analyzes pipeline failures using [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot) and provides AI-powered root cause analysis with actionable fix suggestions — directly in your Pipeline Run Summary.

<img src="failure.png" alt="Copilot Failure Analysis Screenshot" width="100%" />

---

🌐 **Leer en español:** [README.es.md](README.es.md)

---

## 📑 Table of Contents
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [What You'll See](#-what-youll-see)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Follow Me](#-follow-me-on-social-media)

## ✨ Features

- 🔍 **Automatic failure detection** — Analyzes pipeline failures without manual intervention
- 🤖 **AI-powered analysis** — Uses GitHub Copilot to understand error patterns and root causes
- 📝 **Actionable suggestions** — Provides specific fix recommendations, not just error descriptions
- 🎯 **Zero overhead on success** — The analysis step only runs when the pipeline fails
- 🔒 **Secure** — Uses your GitHub PAT via Azure DevOps service connections
- 📊 **Dedicated results tab** — View analysis in a custom "🤖 Copilot Failure Analysis" tab

## 🛠️ How It Works

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
Displays results in Pipeline Run Summary + custom tab
```

1. The decorator runs as a **post-job step** on every agent job
2. On failure, it fetches the timeline for the current build and identifies failed tasks
3. It collects the last N lines of each failed task's log (configurable, default 150)
4. A prompt with CI/CD context and logs is sent to `npx @github/copilot -sp`
5. Copilot's analysis appears in the **🤖 Copilot Failure Analysis** tab and **Extensions** tab
6. The analysis step **never fails your pipeline** — all errors are caught and reported as warnings

## 📋 Prerequisites

- **Azure DevOps organization** with admin permissions to install extensions
- **GitHub account** with an active **GitHub Copilot** license (Individual, Business, or Enterprise)
- **GitHub Personal Access Token (PAT)** from a Copilot-licensed account
- **Node.js** available on the build agent (Microsoft-hosted agents include it by default)

## 🚀 Installation

### Step 1: Install the Extension

> **Note:** Pipeline decorators can only be deployed as **private extensions**. This is a Microsoft platform constraint.

```bash
tfx extension publish \
  --manifest-globs azure-devops-extension.json \
  --share-with <your-ado-org-name> \
  --token <your-marketplace-pat>
```

Then go to **Organization Settings** → **Extensions** → **Shared** tab → click **Install**.

For full deployment steps, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Step 2: Create the Service Connection

1. Go to **Project Settings** → **Service connections**
2. Click **New service connection** → select **GitHub**
3. Configure:
   - **Connection name:** `GitHub Copilot CLI Decorator` *(must match exactly)*
   - **Personal Access Token:** Your GitHub PAT with Copilot license
4. Check **"Grant access permission to all pipelines"**
5. Click **Save**

> ⚠️ **Important:** The service connection name must be exactly `GitHub Copilot CLI Decorator`.

> 💡 **Pro Tip:** Instead of creating a service connection in each project, you can create it once at the **Organization level** and share it across all projects. Go to **Organization Settings** → **Service connections** → create the connection there → then use **Security** to grant access to all projects. This way you only need to manage it in one place!

## ⚙️ Configuration

### Opt-Out (Optional)

To disable Copilot analysis for a specific pipeline:

```yaml
variables:
  COPILOT_ANALYSIS_DISABLED: 'true'
```

### Task Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `maxLogLines` | `150` | Maximum log lines to collect per failed step |
| `copilotNpxTimeout` | `120` | Timeout in seconds for Copilot CLI |

## 👀 What You'll See

When a pipeline fails, you'll find the analysis in:

### 🤖 Copilot Failure Analysis Tab

A dedicated tab with:
- **Root Cause** — Why the pipeline failed
- **Details** — Detailed error analysis
- **Suggested Fix** — Actionable steps to resolve the issue

### Extensions Tab

The same Markdown summary also appears in the legacy Extensions tab.

## 🏗️ Architecture

| Module | Purpose |
|--------|---------|
| `config.ts` | Reads task inputs and service connection credentials |
| `log-collector.ts` | Fetches failed task logs via Azure DevOps REST API |
| `prompt-builder.ts` | Constructs the analysis prompt with CI/CD context |
| `ai-analyzer.ts` | Invokes Copilot CLI via `npx @github/copilot -sp` |
| `output-formatter.ts` | Formats results and uploads the summary |
| `index.ts` | Orchestrates the full analysis flow |

For the complete architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🔧 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Service connection not configured | Create a GitHub service connection named exactly `GitHub Copilot CLI Decorator` |
| Copilot CLI timeout | Increase `copilotNpxTimeout` or check network connectivity |
| npx command not found | Ensure Node.js is installed on the agent |
| No failed tasks found | Check `System.AccessToken` has build read permissions |

See [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting) for more details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and run tests (`npm test`)
4. Commit (`git commit -m 'feat: add my feature'`)
5. Push (`git push origin feature/my-feature`)
6. Open a Pull Request

### Development Setup

```bash
npm install       # Install dependencies
npm run build     # Build
npm test          # Run tests
npm run package-extension:dev  # Package dev extension
```

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🌐 Follow Me on Social Media

If you liked this project, don't forget to follow me on my social networks:

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Follow-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Follow-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>
