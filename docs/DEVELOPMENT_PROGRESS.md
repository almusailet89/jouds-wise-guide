# Jood launch development

## 19 September 2026 — foundation work (local, not deployed)

- Frontend TypeScript check passes. The audit's 48 errors were reduced to zero by correcting UI callbacks, preserving typed settings definitions, removing duplicate translation keys while preserving their runtime values, and updating the database type snapshot against repository migrations.
- Added versioned setup for admin feature flags, support tickets/messages, discount definitions and monthly budget. These contracts were previously referenced by the UI without migration definitions. They have NOT been reconciled against the live database or applied there.
- Added executable PostgreSQL access-control tests. Tested on a disposable local PostgreSQL 14 instance: account isolation, blocked impersonation, admin access, and discount constraints pass. This exercises the new migration in isolation, not the full historical schema or production policies.
- CI now runs real type checking and builds without swallowing errors, retains frontend lint enforcement, and runs the isolated database test. Removed references to unconfigured Playwright/Chromatic jobs. Browser tests remain a release requirement to implement.
- Lint targets the application source rather than the vendored Supabase source tree. Existing explicit-any lint debt remains; no lint rule was disabled to hide it. Supabase edge-function checks still need their own dedicated job.
- GitHub connector confirmed the remote main checkpoint. Supabase plugin discovery reports installed/enabled, but no Supabase tools are exposed to this task yet. CLI authentication is also unavailable. Awaiting the plugin attachment before live schema verification.

## Next work, in order

### Additional local hardening

- Replaced Supabase offline response caching with network-only requests using `no-store`. Added a worker activation hook to remove the legacy private cache on upgrade while preserving public asset caches.
- Added two Node tests for cache cleanup and the generated production worker. Run `npm run build` before `npm test`; CI follows this order. These are automated worker checks, not a completed real-device PWA upgrade test.
- Replaced simulated third-party connection controls with bilingual unavailable states. The page no longer accepts API keys or reports fake OAuth success. Previously saved local integration data is not read or used; a broader browser-storage cleanup still needs to be implemented.
- Supabase MCP endpoint returns the expected unauthenticated HTTP 401, confirming reachability. Skills are available, but database tools are still absent from this session. Live schema reconciliation remains pending authentication/tool activation.
- Removed public claims that were not substantiated by the verified implementation: market-first status, financial-adviser positioning, PDPL registration/compliance, CITC licensing, no-card trial, unlimited chat, plan-specific voice minutes and enhanced privacy. Landing and pricing routes now clearly identify the product as a private beta and do not initiate checkout.
- Browser-verified the updated landing and beta-access routes in the local preview. Both render meaningful content without a Vite error overlay, and navigation between them works. Authenticated dashboard journeys still require a dedicated test account and staging verification.
- Added sign-out cleanup for user-scoped browser preferences, reminder history, legacy integration keys and any user-specific caches. Language preference remains so the public/sign-in experience does not unexpectedly switch language.

1. Read-only Supabase schema/policy/migration inspection; reconcile the proposed migration and regenerate authoritative database types. Do not apply an unverified migration over manually created live tables.
2. Resolve remaining lint debt, establish complete staging setup and critical end-to-end tests.
3. Secure voice identity binding, privacy preferences, export/deletion and private caching.
4. Verify one complete Arabic secretary workflow including background reminders.
5. Complete genuine integrations, billing entitlements, Saudi payment/invoicing setup and measured usage controls.
6. Design/accessibility review, device testing, deployment/rollback rehearsal and invited beta.

No production schema changes, function deployments, billing changes, commits or pushes were performed in this milestone.
