### 2026-03-03T18:00:00Z: User directive — Service Connection for PAT
**By:** Gisela Torres (via Copilot)
**What:** La org ahora tiene una service connection compartida en todos los repos llamada "GitHub Copilot CLI Decorator" que contiene el PAT que necesita Copilot CLI para autenticarse. Esto reemplaza el enfoque de Variable Group descrito en D2/D2-R.
**Why:** User request — captured for team memory
**Impact:** Supersedes D2 (Variable Group) and D2-R (GITHUB_TOKEN from variable). Task code must read PAT from service connection via `tl.getEndpointAuthorizationParameter()`. Decorator YAML needs `connectedService` input reference. Architecture doc section 3.2 needs update.
