# TRANSFER PLAN (Repo-wide audit, plan only — no edits yet)

Scope: analyze the entire repo starting at `jouds-wise-guide/`, including the canonical app `jouds-wise-guide/jouds-wise-guide/`. Do not modify files; produce a plan only. Canonical runtime target is the 8083 app at `jouds-wise-guide/jouds-wise-guide/`. Everything else is legacy or support unless proven required.


## Findings snapshot

- **Canonical app**: `jouds-wise-guide/jouds-wise-guide/` (React + Vite + Supabase Edge Functions + migrations). Vite server currently configured on port `8080` in `vite.config.ts`.
- **Duplicate Supabase folders**:
  - Canonical: `jouds-wise-guide/jouds-wise-guide/supabase/` (functions deployed and used by the app).
  - Legacy: `jouds-wise-guide/supabase/` (older functions/migrations not referenced by the app code).
- **Functions referenced by UI** (grep in `src/**`):
  - `ai-chat`, `text-to-speech`, `speech-to-text`, `manage-finance`, `manage-portfolio`, `get-financial-insights`, `get-financial-news`, `refresh-prices`, `check-subscription`, `create-checkout`, `customer-portal` — all present under canonical `supabase/functions/`.
  - Not referenced by UI: `assistant-actions`, `memory-query`, `savings-contribute`, `portfolio-refresh`, `prices-btc`, `admin-reset` (exist only in top-level `supabase/functions/`).
- **Top-level Python utilities** (both at repo root and duplicated inside canonical folder): `app.py`, `avatar_controller.py`, `avatar_widget.py`, `chat_module.py`, `financial_advisor.py`, `planner_engine.py`, `voice_module.py`, `main_dashboard.py`, etc. No imports or references found from the canonical app TS/TSX.
- **Large media**: many `.mp4` in top-level `assets/` and `.mp3` duplicates. No direct references from the app.
- **Mock JSON dumps**: various JSON files found at `jouds-wise-guide/jouds-wise-guide/*.json` (e.g., `mood_log.json`, `portfolio.json`, `transactions.json`, `planner_tasks.json`, `tasks.json`, `user_profile.json`). No references from the app codebase.
- **Supabase types drift**: `src/integrations/supabase/types.ts` likely predates new tables/views (`scheduled_notifications`, `calendar_events`, `price_alerts`, `alerts`, `goals_progress`, updated `price_history`). Recommend regenerating types (plan-only for now).


# TRANSFER to 8083 (move into canonical app)

- **None required at this time**
  - All functions used by the app are already in `jouds-wise-guide/jouds-wise-guide/supabase/functions/`.
  - No LiveKit/voice token server or external services detected in use outside the canonical folder.

Optional wiring (no move, just future edits to consider):
- **Vite port to 8083**: change `server.port` in `jouds-wise-guide/jouds-wise-guide/vite.config.ts` from `8080` to `8083`, or run `npm run dev -- --port 8083`.
- **Regenerate Supabase types** after migration alignment:
  - Command (plan only):
    ```bash
    supabase gen types typescript --linked > jouds-wise-guide/jouds-wise-guide/src/integrations/supabase/types.ts
    ```
- **refresh-prices invocation**: current UI calls `supabase.functions.invoke('refresh-prices')` without auth header. Since `verify_jwt=true` and the function uses service role, prefer invoking from a server-side context or a proxy function that validates the user and then calls the service function.


# ARCHIVE (relocate to jouds-wise-guide/_archive_8083_misc/)

Move, keep for reference, not used by the 8083 app:

- **Top-level Supabase (legacy)**
  - Source: `jouds-wise-guide/supabase/`
  - Target: `jouds-wise-guide/_archive_8083_misc/supabase_legacy/`
  - Reason: duplicates canonical functions/migrations; some functions not used by the app.
  - Commands (do not run yet):
    ```bash
    git mv supabase _archive_8083_misc/supabase_legacy
    ```

- **Top-level 8080 archived app**
  - Source: `jouds-wise-guide/_archive_8080_app/`
  - Target: `jouds-wise-guide/_archive_8083_misc/_archive_8080_app/`
  - Reason: legacy; keep grouped under new archive hub.
  - Commands:
    ```bash
    git mv _archive_8080_app _archive_8083_misc/_archive_8080_app
    ```

- **Python utilities (root and duplicated inside canonical)**
  - Sources (root): files like `app.py`, `avatar_controller.py`, `avatar_widget.py`, `chat_module.py`, `financial_advisor.py`, `planner_engine.py`, `voice_module.py`, `main_dashboard.py`, etc.
  - Sources (canonical duplicates): `jouds-wise-guide/jouds-wise-guide/*.py`
  - Target: `jouds-wise-guide/_archive_8083_misc/python_legacy/`
  - Reason: not referenced by the 8083 app; archive for future reuse.
  - Commands:
    ```bash
    git mv *.py _archive_8083_misc/python_legacy/  # run at repo root
    git mv jouds-wise-guide/*.py _archive_8083_misc/python_legacy/  # from canonical folder
    ```

- **Large media (curated keep, archive rest)**
  - Source: `jouds-wise-guide/assets/*.mp4`, root-level `*.mp3` duplicates.
  - Target: `jouds-wise-guide/_archive_8083_misc/assets-samples/`
  - Reason: not referenced by app; reduce repo weight; keep a small curated sample.
  - Commands (example):
    ```bash
    mkdir -p _archive_8083_misc/assets-samples
    git mv "assets/Avatar IV Video.mp4" _archive_8083_misc/assets-samples/
    git mv "assets/Ai Joud Add .mp4" _archive_8083_misc/assets-samples/
    git mv "voice_preview_jood - elegente voice .mp3" _archive_8083_misc/assets-samples/
    # After archiving samples, remaining large media can be deleted (see DELETE section)
    ```

- **Mock JSON dumps** (unused)
  - Source: `jouds-wise-guide/jouds-wise-guide/*.json` like `mood_log.json`, `portfolio.json`, `transactions.json`, `planner_tasks.json`, `tasks.json`, `user_profile.json`.
  - Target: `jouds-wise-guide/_archive_8083_misc/mock_data/`
  - Reason: not referenced by the app; preserve for later reference.
  - Commands:
    ```bash
    mkdir -p _archive_8083_misc/mock_data
    git mv jouds-wise-guide/mood_log.json _archive_8083_misc/mock_data/  || true
    git mv jouds-wise-guide/portfolio.json _archive_8083_misc/mock_data/  || true
    git mv jouds-wise-guide/transactions.json _archive_8083_misc/mock_data/  || true
    git mv jouds-wise-guide/planner_tasks.json _archive_8083_misc/mock_data/  || true
    git mv jouds-wise-guide/tasks.json _archive_8083_misc/mock_data/  || true
    git mv jouds-wise-guide/user_profile.json _archive_8083_misc/mock_data/  || true
    ```


# DELETE (junk/unreferenced)

Safe to remove after archiving what you want to keep:

- **Binary clutter & OS files**
  - `**/*.pyc`, `**/__pycache__/`, `.DS_Store`.
- **Lock files not used**
  - `bun.lockb` (if present).
- **Unreferenced large media**
  - Any remaining `assets/*.mp4` and duplicate `*.mp3` after archiving a small set above.
- **Obsolete JSON dumps**
  - Unused JSON dumps at repo root or canonical root after archiving (verify no usage first).

Proposed `.gitignore` additions (plan-only):
```gitignore
# OS & Python caches
.DS_Store
**/__pycache__/
**/*.pyc

# Bun lock if not used
bun.lockb

# Large, untracked media dumps (adjust to what you keep)
assets/**/*.mp4
assets/**/*.mov
assets/**/*.wav
assets/**/*.mp3

# Local test data at root (avoid accidental re-add)
/*.json
/_archive_8083_misc/**
```


# Acceptance Checklist

- [ ] From `jouds-wise-guide/jouds-wise-guide/`:
  - [ ] `npm run build` succeeds
  - [ ] `npx tsc --noEmit` passes
  - [ ] `npm run dev -- --port 8083` serves without missing imports
- [ ] `supabase functions list` enumerates only intended functions used by the app:
  - `ai-chat`, `text-to-speech`, `speech-to-text`, `manage-finance`, `manage-portfolio`, `get-financial-insights`, `get-financial-news`, `refresh-prices`, `check-subscription`, `create-checkout`, `customer-portal`, plus newly added `finance-actions`, `portfolio-actions`, `tasks-actions`, `alerts-actions` (if retained by product scope).
- [ ] If adopting any Python utilities later:
  - [ ] Decide launch strategy (e.g., FastAPI on separate port)
  - [ ] Define how 8083 app calls them (HTTP, ws://, etc.) and env vars required


## Notes / Rationale

- Keeping the canonical Supabase tree under `jouds-wise-guide/jouds-wise-guide/supabase/` avoids drift with the app’s code and migrations.
- Archiving rather than deleting Python utilities preserves optional ML/agent workflows without polluting the 8083 app scope.
- Reducing large media lowers clone times and CI storage; the app doesn’t reference these assets.
- Types drift: re-generating Supabase TypeScript types after recent DB changes will improve type-safety and avoid runtime surprises.
