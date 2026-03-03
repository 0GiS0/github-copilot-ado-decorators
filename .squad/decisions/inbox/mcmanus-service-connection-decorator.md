# McManus Decision: Service Connection in Decorator YAML

**Date:** 2026-03-03  
**Author:** McManus  
**Status:** Implemented

## Context
The org now has a shared Generic (ExternalServer) service connection named "GitHub Copilot CLI Decorator" containing the GitHub PAT for Copilot CLI authentication. This replaces the Variable Group approach (D2/D2-R).

## Decision
- Decorator YAML (`decorator/copilot-failure-analysis.yml`) references the service connection via `inputs.connectedServiceName: 'GitHub Copilot CLI Decorator'`
- Task manifest (`task.json`) declares a `connectedService:ExternalServer` input named `connectedServiceName`
- No custom service endpoint contribution needed in `vss-extension.json` — the built-in `ExternalServer` type is sufficient
- `GITHUB_TOKEN` env var is no longer set from a variable group; the task will retrieve the PAT from the service connection at runtime using `tl.getEndpointAuthorizationParameter()`

## Impact
- Verbal must use `tl.getEndpointAuthorizationParameter(connectedServiceName, 'apitoken', true)` in the task to extract the PAT
- Supersedes D2 (Variable Group) and D2-R (GITHUB_TOKEN from variable) for PAT retrieval
