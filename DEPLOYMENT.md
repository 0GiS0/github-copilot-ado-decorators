# Deployment Guide — GitHub Copilot Pipeline Failure Analyzer

> Step-by-step guide to deploy this extension to an Azure DevOps organization.  
> Author: Keaton (Lead) — 2026-03-03

---

## Table of Contents

- [Phase A: Prerequisites](#phase-a-prerequisites)
- [Phase B: Build the Extension](#phase-b-build-the-extension)
- [Phase C: Publish as Private Extension](#phase-c-publish-as-private-extension)
- [Phase D: Install in Azure DevOps Organization](#phase-d-install-in-azure-devops-organization)
- [Phase E: Configure the GitHub PAT (Service Connection)](#phase-e-configure-the-github-pat-service-connection)
- [Phase F: Verify with Test Decorator](#phase-f-verify-with-test-decorator)
- [Phase G: Test the Failure Analysis](#phase-g-test-the-failure-analysis)
- [Phase H: Updating the Extension](#phase-h-updating-the-extension)
- [Troubleshooting](#troubleshooting)

---

## Important: Private Extension Only

**Pipeline decorators can ONLY be deployed as private extensions.** This is a platform constraint imposed by Microsoft — not a design choice. You cannot publish this extension to the public Visual Studio Marketplace. It must be shared privately with each Azure DevOps organization that needs it.

---

## Phase A: Prerequisites

Before you begin, ensure you have the following:

### 1. Install Node.js and npm

You need Node.js (v18 or later) and npm installed on your development machine.

```bash
# Verify installation
node --version    # Should be v18+
npm --version     # Should be v9+
```

If not installed, download from [https://nodejs.org](https://nodejs.org).

### 2. Install tfx-cli

The `tfx-cli` (Team Foundation Extensions CLI) is Microsoft's tool for packaging and publishing Azure DevOps extensions.

```bash
npm install -g tfx-cli
```

Verify:

```bash
tfx --version
```

### 3. Create a Visual Studio Marketplace Publisher

You need a publisher account on the Visual Studio Marketplace. *If you already have one (e.g., `returngisorg`), skip to step 4.*

1. Go to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account (the one linked to your Azure DevOps organization)
3. Click **Create publisher**
4. Fill in:
   - **Publisher ID:** A unique identifier (e.g., `returngisorg`). This must match the `publisher` field in `vss-extension.json`
   - **Display name:** Your organization or personal name
5. Click **Create**

> **Note:** The publisher ID in `vss-extension.json` must match exactly. If you use a different publisher, update the manifest before building.

### 4. Azure DevOps Organization Admin Access

You need **Organization Administrator** or **Project Collection Administrator** permissions in the target Azure DevOps organization to:

- Install extensions
- Create organization-level variable groups
- Share extensions with the organization

### 5. GitHub Personal Access Token (PAT) with Copilot License

You need a GitHub PAT from a user account that has an **active GitHub Copilot license** (Individual, Business, or Enterprise).

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)** or **Fine-grained token**
3. For a classic token, no special scope like `models:read` is strictly required — the Copilot license on the account is what grants CLI access. However, ensure the token is valid and not expired.
4. Copy the token — you'll need it in Phase E

> **Important:** The Copilot CLI authenticates via the `GITHUB_TOKEN` environment variable. The PAT must be from an account/org with an active Copilot license.

### 6. Marketplace Publishing PAT

You need a separate Azure DevOps PAT for publishing extensions to the Marketplace.

1. Go to your Azure DevOps organization → **User Settings** → **Personal Access Tokens**
2. Click **New Token**
3. Set:
   - **Organization:** All accessible organizations
   - **Scopes:** Select **Marketplace** → **Manage** (full access)
   - **Expiration:** Set an appropriate expiration
4. Copy this token — you'll use it with `tfx-cli`

---

## Phase B: Build the Extension

### 1. Clone the repository

```bash
git clone https://github.com/returngis/github-copilot-ado-decorators.git
cd github-copilot-ado-decorators
```

### 2. Install dependencies

```bash
npm install
```

### 3. Compile TypeScript

```bash
npm run build
```

This compiles the TypeScript source files in `src/` to JavaScript.

### 4. Verify the publisher ID

Open `vss-extension.json` and confirm the `publisher` field matches your Marketplace publisher:

```json
{
    "publisher": "returngisorg",
    ...
}
```

If it doesn't match, update it before packaging.

### 5. Package the extension (.vsix)

```bash
tfx extension create --manifest-globs vss-extension.json
```

This generates a `.vsix` file in the current directory, e.g.:

```
returngisorg.copilot-failure-analysis-0.1.0.vsix
```

> **Tip:** The filename follows the pattern `{publisher}.{extensionId}-{version}.vsix`.

---

## Phase C: Publish as Private Extension

There are two approaches: **publish-and-share in one step** or **create then share separately**.

### Option 1: Publish and share in one command (Recommended)

```bash
tfx extension publish \
  --manifest-globs vss-extension.json \
  --share-with <your-ado-org-name> \
  --token <your-marketplace-pat>
```

Replace:
- `<your-ado-org-name>` — Your Azure DevOps organization name (the part after `dev.azure.com/`)
- `<your-marketplace-pat>` — The PAT you created in Phase A, step 6

**Example:**

```bash
tfx extension publish \
  --manifest-globs vss-extension.json \
  --share-with mycompany \
  --token eyJ0eXAiOiJKV1Qi...
```

To share with multiple organizations:

```bash
tfx extension publish \
  --manifest-globs vss-extension.json \
  --share-with org1 org2 org3 \
  --token <your-marketplace-pat>
```

### Option 2: Create, then share separately

**Step 1 — Create the .vsix and publish:**

```bash
tfx extension publish \
  --manifest-globs vss-extension.json \
  --token <your-marketplace-pat>
```

**Step 2 — Share with the organization:**

```bash
tfx extension share \
  --publisher returngisorg \
  --extension-id copilot-failure-analysis \
  --share-with <your-ado-org-name> \
  --token <your-marketplace-pat>
```

### Option 3: Use saved credentials

To avoid passing the token every time, log in first:

```bash
tfx login --service-url https://marketplace.visualstudio.com \
  --token <your-marketplace-pat>
```

Then subsequent commands don't need `--token`:

```bash
tfx extension publish --manifest-globs vss-extension.json --share-with mycompany
```

> **Note:** Since this is a private extension (no `"public": true` flag in the manifest), it is automatically private. Only organizations you explicitly share it with can see and install it.

---

## Phase D: Install in Azure DevOps Organization

After publishing and sharing, the extension must be **installed** in the target organization.

### Option 1: Via Organization Settings (Recommended)

1. Go to your Azure DevOps organization: `https://dev.azure.com/<your-org>`
2. Click **Organization settings** (bottom-left gear icon)
3. Under **General**, click **Extensions**
4. Click the **Shared** tab
5. Find **GitHub Copilot Pipeline Failure Analyzer** in the list
6. Click on it, then click **Install**
7. Select the organization and click **Install**

> **What you'll see:** The Shared tab shows all extensions that have been shared with your organization but not yet installed. After clicking Install, the extension moves to the Installed tab.

### Option 2: Via direct Marketplace URL

1. Go to: `https://marketplace.visualstudio.com/items?itemName=returngisorg.copilot-failure-analysis`
2. Click **Get it free**
3. Select your organization from the dropdown
4. Click **Install**

> **Note:** This URL only works for users who belong to an organization the extension has been shared with.

### Option 3: Via tfx-cli

```bash
tfx extension install \
  --publisher returngisorg \
  --extension-id copilot-failure-analysis \
  --service-url https://dev.azure.com/<your-org> \
  --token <your-ado-pat>
```

---

## Phase E: Configure the GitHub PAT (Service Connection)

The extension needs a GitHub PAT (with Copilot license) to call the Copilot CLI. The PAT is stored in an **Azure DevOps service connection** of type Generic (ExternalServer).

### Create the Service Connection

1. Go to your Azure DevOps project: `https://dev.azure.com/<your-org>/<your-project>`
2. Click **Project settings** (bottom-left gear icon)
3. Under **Pipelines**, click **Service connections**
4. Click **New service connection**
5. Select **Generic** (also shown as "External Server")
6. Fill in:
   - **Server URL:** `https://github.com` (placeholder — the task does not use this URL)
   - **Password/Token Key:** Paste your GitHub PAT (the one with an active Copilot license)
   - **Service connection name:** `GitHub Copilot CLI Decorator` (must match exactly)
   - **Description:** *(optional)* GitHub PAT for Copilot CLI failure analysis
   - **☑ Grant access permission to all pipelines:** **Check this box** — critical because the decorator injects into all pipelines automatically
7. Click **Save**

> **Important:** The "Grant access permission to all pipelines" checkbox must be enabled. Without it, each pipeline would need individual authorization to use the service connection, which defeats the purpose of an org-wide decorator.

> **Security:** Service connection credentials are encrypted at rest, managed by Azure DevOps, and masked in pipeline logs. The PAT value will never be displayed in plain text.

### Verify the Service Connection

1. Go to **Project settings** → **Service connections**
2. Find **GitHub Copilot CLI Decorator** in the list
3. Click on it and verify:
   - Status shows as configured
   - "Grant access permission to all pipelines" is enabled (check under **Security**)

> **Note:** If the service connection is not configured or not accessible, the analysis step simply logs "Copilot analysis skipped — service connection not configured" and exits cleanly. It will NOT fail the pipeline.

---

## Phase F: Verify with Test Decorator

The extension includes a test decorator to verify it's working correctly after installation, without waiting for a real pipeline failure.

### 1. Enable test mode in a pipeline

Add the following variable to a pipeline run:

```yaml
variables:
  COPILOT_TEST_MODE: 'true'
```

Or set it for a single run:

1. Go to the pipeline
2. Click **Run pipeline**
3. Click **Variables**
4. Add variable: `COPILOT_TEST_MODE` = `true`
5. Click **Run**

### 2. Run the pipeline

Run the pipeline (it can be any pipeline — it doesn't need to fail).

### 3. Check the results

- Look at the pipeline run's job steps
- You should see a step called **🤖 Copilot Failure Analysis (Test)** or similar
- This confirms the decorator is being injected correctly by the extension

### 4. Disable test mode

After verification, remove the `COPILOT_TEST_MODE` variable:

- Remove it from the YAML file, or
- If you set it as a one-time run variable, it's already gone

> **Important:** Always remove `COPILOT_TEST_MODE` after testing. The test decorator is only meant for verification purposes.

---

## Phase G: Test the Failure Analysis

Now test the actual failure analysis flow.

### 1. Trigger a pipeline failure

Either wait for a natural failure, or create an intentional one:

```yaml
# Example: add a step that always fails
steps:
  - script: |
      echo "This step will fail intentionally"
      exit 1
    displayName: 'Intentional failure for testing'
```

### 2. Check for the analysis step

After the pipeline fails:

1. Open the failed pipeline run
2. Look at the job's steps — you should see a step called **🤖 Copilot Failure Analysis**
3. This step runs automatically because `condition: failed()` triggers it

### 3. View the analysis results

**In the step output:**
- Click on the **🤖 Copilot Failure Analysis** step
- Read the AI-generated analysis in the step log output

**In the Extensions tab:**
- On the pipeline run page, click the **Extensions** tab
- Find the **Copilot Failure Analysis** summary
- This contains the Markdown-formatted analysis with:
  - **Root Cause** — Why the pipeline failed
  - **Details** — Detailed error analysis
  - **Suggested Fix** — Actionable steps to resolve the issue
  - **Related Documentation** — Relevant links if applicable

### 4. Validate end-to-end

Confirm the following worked:

- [ ] The decorator step was injected into the job
- [ ] The step ran after the failure (not before)
- [ ] Logs were collected from the failed steps
- [ ] The Copilot CLI produced an analysis
- [ ] The analysis appears in both the step output and the Extensions tab summary

---

## Phase H: Updating the Extension

When you make changes to the extension and need to deploy an update:

### 1. Increment the version

Open `vss-extension.json` and increment the `version` field:

```json
{
    "version": "0.2.0"
}
```

Also update the version in `src/copilot-failure-analysis-task/task.json`:

```json
{
    "version": {
        "Major": 0,
        "Minor": 2,
        "Patch": 0
    }
}
```

> **Important:** You must increment the version — the Marketplace rejects re-uploads of the same version.

### 2. Rebuild and republish

```bash
npm run build
tfx extension publish --manifest-globs vss-extension.json --token <your-marketplace-pat>
```

No need to re-share — the extension is already shared with the organization(s).

### 3. Automatic update

Organizations that have the extension installed will automatically receive the update. There is no need to reinstall.

> **Note:** The update may take a few minutes to propagate. Pipeline runs started immediately after publishing might still use the previous version.

### 4. Verify the update

Run a pipeline and check the extension version in the step output to confirm the new version is active.

---

## Troubleshooting

### Extension doesn't appear in the Shared tab

| Possible Cause | Fix |
|---|---|
| Extension wasn't shared with the org | Run: `tfx extension share --publisher returngisorg --extension-id copilot-failure-analysis --share-with <org-name>` |
| Wrong org name | Verify the org name matches exactly what appears after `dev.azure.com/` |
| Publisher not linked | Ensure the publisher account is associated with the same Microsoft account that manages the org |
| Token expired or wrong scope | Create a new PAT with **Marketplace → Manage** scope |

### "The extension manifest is not valid" during publish

| Possible Cause | Fix |
|---|---|
| Missing required fields in `vss-extension.json` | Ensure `id`, `publisher`, `version`, `name`, `targets`, and `contributions` are all present |
| Missing referenced files | Ensure all files listed in the `files` array exist on disk (e.g., `logo.png`, `overview.md`, decorator YAML) |
| Version conflict | Increment the version — you can't republish the same version |

### Decorator step does not appear in pipeline runs

| Possible Cause | Fix |
|---|---|
| Extension not installed | Go to Organization Settings → Extensions and confirm it's installed (not just shared) |
| Extension disabled | Check the Extensions page — ensure the extension is enabled |
| Decorator contributions cache | Wait a few minutes after installation. ADO caches decorator contributions and may take up to 5 minutes to pick up a new decorator |
| Wrong contribution targets | Verify `vss-extension.json` has the correct target: `ms.azure-pipelines-agent-job.post-job-tasks` |

### Analysis step runs but outputs "Copilot analysis skipped — service connection not configured"

| Possible Cause | Fix |
|---|---|
| Service connection not created | Create a Generic service connection named exactly `GitHub Copilot CLI Decorator` in Project Settings → Service connections |
| Service connection name mismatch | The name must be exactly `GitHub Copilot CLI Decorator` (case-sensitive) |
| "Grant access to all pipelines" not enabled | Edit the service connection → Security → enable "Grant access permission to all pipelines" |
| Service connection in wrong project | The service connection must exist in the same project where the pipeline runs |

### Copilot CLI fails or times out

| Possible Cause | Fix |
|---|---|
| Invalid or expired GitHub PAT | Generate a new PAT and update the variable group |
| No Copilot license on the GitHub account | Ensure the PAT owner has an active Copilot license (Individual, Business, or Enterprise) |
| Node.js version too old | The Copilot CLI requires Node.js 22+. On self-hosted agents, install Node.js 22. On Microsoft-hosted agents, add a `NodeTool@0` step |
| Network/firewall blocking npm/npx | Ensure the agent can reach `registry.npmjs.org` and `api.github.com` |
| npx download timeout | On first run, npx downloads `@github/copilot`. If the agent is slow, increase the `copilotNpxTimeout` task input |

### Analysis is empty or unhelpful

| Possible Cause | Fix |
|---|---|
| Logs too short or not captured | Check if the failed step actually produced logs. Some steps fail silently |
| Prompt too large | Reduce `maxLogLines` task input (default: 150) if logs are very verbose |
| Prompt too small | Increase `maxLogLines` if the error context is at the beginning of the log |

### "Access denied" when calling ADO REST API

| Possible Cause | Fix |
|---|---|
| `System.AccessToken` not available | Ensure the pipeline has not disabled the system token. This is available by default in all pipelines |
| Project permissions | The build service identity needs read access to build logs. This is granted by default |

### Extension update not taking effect

| Possible Cause | Fix |
|---|---|
| Version not incremented | The Marketplace rejects same-version uploads. Bump the version |
| Propagation delay | Wait 5–10 minutes for the update to propagate to agents |
| Agent cache | Self-hosted agents may cache tasks. Restart the agent or clear the `_work/_tasks` directory |

---

## Quick Reference: Key Commands

```bash
# Install tfx-cli
npm install -g tfx-cli

# Build the project
npm install && npm run build

# Package only (creates .vsix without publishing)
tfx extension create --manifest-globs vss-extension.json

# Publish and share with an org
tfx extension publish --manifest-globs vss-extension.json \
  --share-with <org-name> --token <pat>

# Share with additional orgs
tfx extension share --publisher returngisorg \
  --extension-id copilot-failure-analysis \
  --share-with <org-name> --token <pat>

# Unshare from an org
tfx extension unshare --publisher returngisorg \
  --extension-id copilot-failure-analysis \
  --unshare-with <org-name> --token <pat>

# Check extension info
tfx extension show --publisher returngisorg \
  --extension-id copilot-failure-analysis --token <pat>
```

---

## Quick Reference: Key URLs

| Resource | URL |
|---|---|
| Marketplace Publisher Portal | [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) |
| Extension in Marketplace | `https://marketplace.visualstudio.com/items?itemName=returngisorg.copilot-failure-analysis` |
| Org Extensions Settings | `https://dev.azure.com/<org>/_settings/extensions` |
| Pipeline Library (Variable Groups) | `https://dev.azure.com/<org>/<project>/_library` |
| GitHub PAT Settings | [https://github.com/settings/tokens](https://github.com/settings/tokens) |
| Pipeline Decorators Docs | [https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-pipeline-decorator](https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-pipeline-decorator) |
