# Reminders v1, Identity Lock, and Cleanup

This document tracks the status for Reminders v1 (zero extra fetch), Daily Digest, Identity lock, guardrails parity, and deployment.

## Status
- [x] Realtime gating aligned in `src/hooks/useFinancialDashboard.tsx` (wallet disabled in Saver/Offline; financial entries enabled except Offline)
- [x] Quick Savings write-path via Edge Function `savings-contribute` and client helper in `useDatabase.tsx`
- [x] Overspend guardrails parity
  - [x] finance-actions: map insufficient funds to HTTP 409 with code `INSUFFICIENT_FUNDS`
  - [x] portfolio-actions: new Edge Function with atomic wallet deduction + holding insert via RPC `record_portfolio_buy_with_wallet`
  - [x] Client helpers `recordExpense` and `portfolioBuy` with 409 mapping
  - [x] Assistant chat routes expense and buy commits via those helpers/Functions
- [x] Admin reset (dev-only)
  - [x] Edge Function `admin-reset` with header `x-reset-key` and RPC `reset_dev_data_seed(_seed numeric)`
  - [x] Reset button wires to function and uses local `resetLocalState()` without refetch
  - [x] Button visible only if `DEV_ADMIN=1 && (egressSaver || offline)`
- [x] Identity injection
  - [x] `src/ai/JoodIdentity.ts` exports `SYSTEM_PROMPT`
  - [x] `src/hooks/useAI.tsx` always prepends `SYSTEM_PROMPT` to chat context
  - [ ] Prevent runtime edits to system prompt in UI settings and show banner (if any legacy setting exists)
- [x] Update Daily Brief copy: clarified network status text
- [x] Reminders v1 (client-only UX)
  - [x] Quick Reminder in `src/components/Dashboard/DailyBrief.tsx`: title + HH:MM today + optional note
  - [x] One-shot `recordTask` via `tasks-actions` Edge Function, optimistic local append, no extra fetch
  - [x] Local notification scheduling via `useLocalNotifications.schedule`
  - [x] `TasksReminder` shows an "Enable notifications" CTA
- [x] Daily Digest (client-only)
  - [x] "Send Today’s Digest" button in `DailyBrief.tsx`
  - [x] Composes from local state and schedules a single 08:00 local notification if permitted
- [ ] Tests (unit + E2E)
  - [ ] Unit: `savings-contribute` happy/409
  - [ ] Unit: `finance-actions` happy/409
  - [ ] Unit: `portfolio-actions` happy/409
  - [ ] Snapshot: identity reply
  - [ ] Cypress: Quick Savings success, guardrail errors, Saver gating of realtime
- [ ] Cleanup
  - [ ] Run `npx ts-prune` and prune dead code
  - [ ] Run `vite build` and fix any types/unused exports

## Deployment Steps (Supabase)
1. Install CLI (macOS):
   - `brew install supabase/tap/supabase`
2. Login:
   - `supabase login`
3. Link project:
   - `supabase link --project-ref neadnclykbukvmlquepg`
4. Configure secrets (required by admin-reset and ai-chat):
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref neadnclykbukvmlquepg`
   - `supabase secrets set DEV_RESET_KEY=... --project-ref neadnclykbukvmlquepg`
5. Apply migrations:
   - `supabase db push --project-ref neadnclykbukvmlquepg`
6. Deploy Edge Functions (new/updated):
   - `supabase functions deploy savings-contribute --project-ref neadnclykbukvmlquepg`
   - `supabase functions deploy finance-actions --project-ref neadnclykbukvmlquepg`
   - `supabase functions deploy portfolio-actions --project-ref neadnclykbukvmlquepg`
   - `supabase functions deploy admin-reset --project-ref neadnclykbukvmlquepg`
   - `supabase functions deploy ai-chat --project-ref neadnclykbukvmlquepg`
   - `supabase functions deploy tasks-actions --project-ref neadnclykbukvmlquepg`

Types regeneration (local):
- `supabase gen types typescript --project-id neadnclykbukvmlquepg > src/integrations/supabase/types.ts`

Optional (existing):
- `supabase functions deploy manage-portfolio get-financial-news get-financial-insights refresh-prices --project-ref neadnclykbukvmlquepg`

## Acceptance Criteria Checklist
- [ ] Saver ON: only financial entries realtime remains; wallet realtime disabled; prices/news/portfolio fetch via Refresh only
- [ ] Offline disables Quick Savings with clear message
- [ ] Expense and Buy blocked with consistent 409 handling across UI and chat
- [ ] Identity: "Who are you?" returns fixed Jood line; not editable in UI
- [ ] Quick Reminder creates task, updates UI optimistically, schedules local notification; zero extra fetch
- [ ] Daily Digest composes from local state and can schedule an 08:00 notification
- [ ] Build passes with no `ts-prune` leftovers
