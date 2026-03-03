### 2026-03-03T19:00:00Z: User directive — GitHub Actions CI/CD
**By:** Gisela Torres (via Copilot)
**What:** The extension needs CI/CD deployment capability via GitHub Actions, following the same pattern as the reference project (`github-copilot-chat-extension-ado`). This includes: a `publish.yml` workflow that builds and publishes the extension on push to main using `tfx-cli` and the `ADO_PAT` secret, dual manifest pattern (dev/prod), and npm scripts for packaging and publishing.
**Why:** User request — same workflow as existing project for consistency
**Impact:** Need to add `tfx-cli` as devDependency, create npm scripts (package-extension, publish-extension:dev), create `.github/workflows/publish.yml`, and a production manifest `azure-devops-extension.json` (the existing `vss-extension.json` may need to be restructured into the dev/prod pattern).
