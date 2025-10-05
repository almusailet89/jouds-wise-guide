# Joud AI – No‑Egress Phase

This branch focuses on app wiring and refactors without any external market/pricing calls. Price refresh features remain unchanged and are not invoked in this phase.

## Scope and Constraints
- No calls/changes to pricing or external market APIs.
- Do not modify or invoke `refresh-prices` here.
- All new Edge Functions must set `verify_jwt = true` and derive `user_id` from the JWT. Never accept `user_id` from the client.

## Single Wallet Source
- Canonical source: `public.wallets` table.
- Hook: `useWallet()` in `src/hooks/useDatabase.tsx`.
  - API: `{ wallet, loading, refetch, setWallet(balance, currency?), adjustWallet(delta, currency?) }`.
  - If no wallet row exists, UI shows a friendly toast and creates on first write.

## Chat Preview & History
- Chat preview: When `ai-chat` returns `function_results.preview_mode`, the chat shows a compact preview card with Confirm/Cancel.
- Confirm → commits via `ai-chat` (server executes tools). Cancel → discards preview.
- Chat history: `ChatInterface` loads past messages from `public.ai_interactions` with quick filters (7d/30d/All) and local clear.

## Tasks Planner + Reminders
- Tasks CRUD via `public.tasks` through `useTasks()`.
- Reminders UI calls `tasks-actions` Edge Function:
  - `enqueue`: schedule a reminder in `public.scheduled_notifications`.
  - `digest`: marks due notifications as sent and returns sent count.

## Admin Panel Backend
- New Edge Function: `admin-actions` (verify_jwt=true) lists users via Supabase service role.
- Admin page calls this function and joins with `profiles` and `user_roles` for display.

## Type Hygiene
- Client uses `src/integrations/supabase/types.ts` on this branch. A future step can migrate to `types.generated.ts` once generated.
- The wallet hook casts only where necessary to avoid blocking other work.

## Performance
- Code-splitting with `React.lazy` + `Suspense` for heavy views:
  - `ChatInterface`, `VoicePanel`, `FinancialDashboard`.

## Dev Notes

**Ports**: Frontend runs on port 8083 (`npm run dev -- --port 8083`)

**Manual-Only Pricing**: All price refresh features remain unchanged. No automatic refresh or cron jobs. Use "Sync Now" button only.

**Sync Now Flow**: Single spinner sequence - prices → alerts → tasks digest → holdings/summary/ledger refresh. 15-minute cooldown with tooltip showing "Last updated: Xm ago".

**Required Environment Variables**:
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PRICE_FRESHNESS_MINUTES=15`
- Supabase Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `PRICE_FRESHNESS_MINUTES=15`, `OPENAI_API_KEY`

**Edge Functions**: All use `verify_jwt = true` and derive `user_id` from JWT. Deployed: `admin-actions`, `tasks-actions`, `manage-finance`, `manage-portfolio`.
Frontend (.env.local):
- VITE_SUPABASE_URL=…
- VITE_SUPABASE_ANON_KEY=…
- VITE_PRICE_FRESHNESS_MINUTES=15

Supabase project secrets:
- SUPABASE_SERVICE_ROLE_KEY=…
- PRICE_FRESHNESS_MINUTES=15
- OPENAI_API_KEY=… (for existing AI functions)

## Edge Functions in this branch
- ai-chat (existing, verify_jwt=true)
- tasks-actions (new, verify_jwt=true)
- admin-actions (new, verify_jwt=true)

`supabase/config.toml` includes:
```
[functions.tasks-actions]
verify_jwt = true

[functions.admin-actions]
verify_jwt = true
```

## Local development
- Run app: `npm run dev` (port 8083 typically).
- Build: `npm run build`.

## Supabase: link and deploy
1) Install CLI and login
```
brew install supabase/tap/supabase
supabase login
```
2) Link project
```
supabase link --project-ref neadnclykbukvmlquepg
```
3) Set required secrets (replace values)
```
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... PRICE_FRESHNESS_MINUTES=15 --project-ref neadnclykbukvmlquepg
```
4) Deploy new functions (no pricing functions here)
```
supabase functions deploy tasks-actions --project-ref neadnclykbukvmlquepg
supabase functions deploy admin-actions --project-ref neadnclykbukvmlquepg
```

## Notes
- Price refresh flows are deferred in this phase; the "Sync Now" work already exists from previous work but is untouched here.
- Admin gating relies on `public.user_roles` (role=admin).
- All server actions take identity from the JWT.
