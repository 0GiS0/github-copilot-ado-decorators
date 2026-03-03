## D-CICD: CI/CD Pipeline and Manifest Convention
**Date:** 2026-03-03 | **Author:** McManus | **Status:** Proposed

### Decision
Adopted the reference project (github-copilot-chat-extension-ado) convention for extension manifests and CI/CD:

1. **Manifest naming**: `azure-devops-extension.json` (production) and `azure-devops-extension-dev.json` (dev). Replaces `vss-extension.json`.
2. **Dev manifest**: Separate extension id (`copilot-failure-analysis-dev`) and name (`[DEV]` suffix) to allow parallel installation of dev and prod extensions in the same org.
3. **Build chain**: `tsc` → `tfx extension create` (no webpack needed for decorator extensions).
4. **Publishing**: GitHub Actions workflow (`.github/workflows/publish.yml`) builds on every PR/push to main, publishes dev extension to Marketplace only on push to main via `npm run publish-extension:dev -- --rev-version --token $ADO_PAT`.
5. **Secrets**: `ADO_PAT` GitHub secret required — Azure DevOps PAT with Marketplace publish scope.

### Rationale
- Consistent with Gisela's existing extension projects
- Dev/prod separation avoids accidental overwrites
- `--rev-version` auto-increments version on each publish, no manual version bumps needed
- GitHub Actions provides CI validation on PRs before merge

### Prerequisites
- Configure `ADO_PAT` secret in the GitHub repository
- Replace placeholder `logo.png` with a proper extension icon before first marketplace publish
