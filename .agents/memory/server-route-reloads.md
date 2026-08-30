---
name: Server route reloads
description: Environment behavior when changing Express routes during development
---

Backend route changes are not reliably picked up by the running TypeScript server through client hot reload. Restart the configured application workflow after changing authentication or API routes, then verify the route response and session behavior.

**Why:** A stale server continued serving the SPA fallback for a newly added API route while the client had already refreshed, which looked like an authentication failure.

**How to apply:** After server-side route or middleware edits, restart the existing workflow before testing from the preview.