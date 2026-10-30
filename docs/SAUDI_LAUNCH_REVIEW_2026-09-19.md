# Jood: development checkpoint and Saudi launch assessment

Reviewed 19 September 2026. Scope: local Git history, React application, Supabase function code and migrations, deployment configuration, build/type/lint checks, and official Saudi/payment sources. No application code was changed. Production database, deployed function versions, payment accounts, provider dashboards, and authenticated end-to-end behavior were not verified. The GitHub connector subsequently confirmed that the current remote main commit matches local `11633a95`; other branch references remain locally recorded. The supplied GitHub Pages URL could not be inspected through the available web/browser tools, so its deployed version remains unverified. No separate Claude conversation was available in the task context.

## Decision

Jood is a substantial working prototype approaching a controlled beta, not a verified paid-launch product. Preserve the existing React/Supabase application. The fastest credible route is a mobile web/PWA pilot focused on Arabic daily planning: tell Jood what you need to do, confirm the saved task or appointment, receive a reliable reminder, and review your day.

The Saudi localization already gives this a useful starting point: Arabic/English, RTL, gender-aware wording, Saudi timezone defaults, prayer and Hijri features, SAR pricing, and a Saudi voice experience. These are implemented capabilities, not evidence of customer demand or production reliability.

## Where development stopped

- Branch: `main`, commit `11633a954bcad9b3c96ea955d644f32a6d492fb8`, 5 August 2026, “fix: 5 pre-investment audit bugs.” The working tree was clean before this review.
- Latest change switched daily briefs to Anthropic, repaired task type/creation fields, strengthened recommendations against invented data, and removed an unused Kanban component.
- 10 July commits addressed user-testing bugs, voice length, CORS, navigation, and Arabic numeral input.
- 5 July added compound booking intelligence and Vercel deployment support; 4 July added localization, memory improvements, timezone preferences, and security/feature-flag work.
- Older locally recorded Claude branches include CI and response-quality work; none of the inspected branch tips is newer than the August checkpoint.
- This is the end of a feature-building and bug-fixing phase. It is not evidence that production deployment or launch acceptance testing finished.
- `LAUNCH_CHECKLIST.md` is stale: its $5/$49 pricing and GPT-5 claims conflict with SAR 59/89 plans and actual provider calls. Treat it as historical planning, not certification.

## Product inventory

| Area | What the code contains | Launch interpretation |
|---|---|---|
| Accounts | Supabase sign-in, signup, password recovery, protected pages | Test email delivery, recovery links, session expiry and account isolation in deployment |
| Assistant | Persistent chats, tool-driven actions, memory and pattern analysis | Strongest foundation; verify saved results against what the assistant claims |
| Planning | Tasks, subtasks, priorities, calendar, habits and daily brief | Recommended first product scope |
| Voice | ElevenLabs conversation connection and privileged tool webhook | Valuable but needs identity binding, quotas and device testing |
| Finance | Ledger/dashboard, portfolio, insights, news and zakat features | Defer broad finance positioning until data consistency and regulatory scope are settled |
| Integrations | Google/Microsoft/Slack and other connection UI | OAuth connection success is simulated in the inspected handler |
| Security UI | Consent-like switches, biometric setup, export and deletion | Several controls do not implement the protection their labels imply |
| Distribution | PWA build and Vercel configuration | Good route to pilot without a native rewrite; deployment paths need reconciliation |

## Prioritized findings and acceptance criteria

### 1. Bind voice tools to the authenticated account — before external pilot

`src/components/Voice/MajlisModeAgent.tsx:155` sends `user_id` as a browser dynamic variable. `supabase/functions/elevenlabs-agent-sign/index.ts` authenticates before issuing a signed URL, but does not visibly bind the resulting session to a server-controlled user identity. `supabase/functions/jood-agent-tools/index.ts:46` trusts the tool parameter user ID and operates with service-role privileges. Its shared secret verifies the webhook caller, not the ownership of the supplied user ID.

This is a code-level authorization concern, not a demonstrated production exploit. Bind an opaque voice session to a server-side account mapping and derive the account from that mapping in every tool. Verify that account A cannot read or mutate account B's records through modified voice parameters. Until verified, disable privileged voice actions for public users.

### 2. Make privacy and deletion truthful — before external pilot

`SecurityCenter.tsx` stores encryption, zero-knowledge and data-scope switches in localStorage. The inspected source does not consume these preferences in AI data access. Its WebAuthn credential creation is not backed by a visible server registration/authentication flow. `src/lib/i18n.ts:702` says even Jood cannot read private conversations, while backend functions process conversation/context data.

The delete handler at `SecurityCenter.tsx:146` attempts a selected list of table deletions, does not inspect returned database errors, omits memories and daily briefs, and does not delete the Supabase Auth user or cancel billing. Export also covers only five tables. Replace this with a verified server-side deletion workflow, explicit billing handling, complete data inventory and appropriate retention exceptions. Remove unsupported security claims immediately; persist and enforce any real data-sharing choices server-side.

`vite.config.ts` broadly caches Supabase GET responses. Restrict caching to explicitly public resources, or establish account isolation and logout purge with tests. Private data should not fall back to a previous user's cache.

### 3. Unify billing, plans and usage — before charging

`src/hooks/useSubscription.tsx` advertises Essential SAR 59 and Signature SAR 89, with 20/60 voice minutes and differentiated intelligence. Checkout and subscription checks use Stripe, while AI tier detection reads `subscriptions_moyasar`. The subscription response still classifies monthly/annual rather than Essential/Signature. Chat model selection is based on message complexity/voice mode, not the advertised paid intelligence tier.

`create-checkout/index.ts:26` accepts the price and trial length from the client. Fix these on the server, allowlist products and enforce trial eligibility. Implement one authoritative entitlement record updated by verified, idempotent payment webhooks. Verify cancellation, renewal, refunds, payment failure and duplicate events.

The ElevenLabs signing endpoint has no visible paid entitlement or monthly minute check. Add server-side authorization, usage metering and hard limits. The rate limiter uses read-then-upsert and ignores database error results; it is not an atomic counter despite a comment in ai-chat. Repair this before relying on it for cost control.

### 4. Reconcile database and deployment state — before external pilot

Versioned application migrations do not define several tables used by current code, including `subscriptions_moyasar`, `usage_counters`, `endpoint_rate_limits` and `app_feature_flags`. They may exist through manual production changes; their absence here does not prove production absence. Export an authoritative schema, reconcile migrations, review RLS and regenerate the client types. Demonstrate a fresh staging deployment from the repository.

The active chat function requires OpenAI and uses GPT-4o/GPT-4o-mini; the latest daily brief requires Anthropic. The latest commit's suggestion that other functions all use Claude is inaccurate. Audit actual provider dependencies and deployed secrets without putting credentials in documentation.

Production Vite defaults to `/jouds-wise-guide/`, while the Vercel rewrite and PWA manifest assume `/`. Set and verify a single production base path, domain, auth redirects and CORS origins. Test direct navigation, installed PWA launch, checkout return and password reset.

### 5. Replace unfinished promises with a smaller reliable product

`IntegrationsHub.tsx:359` marks OAuth connections successful after a timer; API keys are stored in browser localStorage. Hide these options or label them unavailable until implemented. Do not ask pilot users to enter real integration credentials.

`useEventReminders.tsx` polls while the app is open; it cannot provide reliable closed-app reminders. For a planner, solve this with server-scheduled delivery and an appropriate supported notification channel, or explicitly limit the pilot promise. Test locked-phone/background behavior on Saudi users' iPhones and Android devices.

Voice tools use `financial_entries` whereas other application flows reference `financial_data`; reconcile the actual schema and behavior before enabling financial writes.

## Verification results

- Production build: passed; warning about chunks larger than 500 kB. PWA precache roughly 2.5 MiB.
- Frontend TypeScript check: 48 errors, including outdated generated database types, profile fields, and UI callback/type issues.
- ESLint over `src`: 169 errors and 41 warnings. These include static-quality issues and are not 169 independently proven runtime defects.
- No configured application test script in the root package. CI calls a missing typecheck script and suppresses its failure; it also references browser/visual test tooling not established by the current root dependencies.
- A passing Vite build does not mean type checking or user journeys pass. Repair CI to require build and type checks plus a small meaningful suite: account isolation, task/calendar actions, payment entitlements, privacy/deletion and notifications.
- Repository includes a large Supabase source tree and older Python/nested application material. Establish the canonical app and exclude unrelated trees from checks/deployment. Cleanup is secondary to pilot blockers.

## Fast Saudi market entry

### Positioning and scope

Start with Saudi working professionals who juggle work and family commitments. This is a segment hypothesis to test with interviews, not a proven market conclusion. Position Jood around a concrete repeated outcome: “Tell Jood what is on your mind; get an organized day and a reminder you can trust.” Use natural Saudi Arabic, including mixed Arabic/English and colloquial time expressions.

Keep chat-to-task/calendar, daily brief, editable memory, Arabic voice only when secured, and reliable reminders. Hide portfolio advice, mood analysis, broad integrations and premium-security promises from the first launch. Use the existing mobile web/PWA application; defer native apps until retention supports the investment.

### Proposed delivery sequence

Assuming one experienced full-time engineer, timely founder decisions and access to production/provider accounts:

1. Days 1–3: reconcile deployed state and schema; freeze scope; hide simulated functions; remove unsupported claims; establish staging and critical acceptance tests.
2. Days 4–10: fix privacy/deletion, voice identity, core task/calendar reliability, provider configuration, deployment paths and background reminder delivery. Prepare Arabic onboarding and support. Start payment-provider onboarding in parallel.
3. Days 11–14: invite 20–30 adults from the founder's professional network to a controlled pilot only after those checks pass. Observe onboarding and the first completed planning action; record errors and feedback without collecting unnecessary private content.
4. Weeks 3–4: unify billing and usage, validate renewals/refunds, then offer a paid pilot if onboarding and engagement support it. Provider approval, schema recovery or privacy remediation could extend this estimate.

Avoid a broad paid campaign during the repair phase. Use founder-led invitations and short Arabic demonstrations of the actual workflow. Test small creator campaigns only after retention; show outcomes rather than feature lists.

### Pricing and evidence gates

Start with one honest plan. SAR 59/month is already in the UI and is a reasonable test hypothesis, not a validated price. Do not sell SAR 89 differentiation until the code actually delivers it. Avoid unlimited usage promises without enforceable controls. Measure model, voice, hosting, payment and support costs per active/paying user, including heavy users; set limits based on contribution margin.

Suggested pilot decision thresholds, not industry benchmarks: at least 70% complete a first useful planning action in the initial session; at least 40% of activated pilot users return in week two; at least 95% success on a defined set of Arabic create/edit/cancel actions; zero cross-account failures; and at least five pilot users actually pay the tested price. Small samples provide direction, not statistical proof. Do not scale acquisition until the core action, reminder delivery and unit economics hold up.

## Saudi commercial and regulatory work

- Privacy: map Supabase, OpenAI, Anthropic, ElevenLabs and any analytics processing; establish purposes, retention, rights handling, processor terms and applicable cross-border safeguards. Do not equate a “PDPL-ready” label or Saudi hosting with compliance. SDAIA publishes the PDPL and overseas-transfer requirements: https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx
- Payments: verify the existing Stripe merchant's legal entity and eligibility against its supported countries before depending on it: https://stripe.com/global . For a Saudi merchant, evaluate a local provider with mada and Apple Pay. Moyasar advertises these and recurring payment capabilities; confirm your specific subscription flow and merchant eligibility: https://moyasar.com/en/
- Tax/invoicing: confirm VAT treatment and any applicable e-invoicing obligations with the accountant. A payment gateway receipt alone does not establish compliance. ZATCA explains scope and phased integration: https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/What-is-e-invoicing.aspx
- Financial scope: remove “Financial Advisor” launch positioning and keep any later finance feature to a clearly defined scope pending specialist review. CMA identifies securities business activities as subject to authorization; a disclaimer alone does not decide classification: https://cma.gov.sa/en/RulesRegulations/FAQ/Pages/FAQs.aspx

## Next development checkpoint

Resume from `11633a95` with a launch-hardening milestone, not another feature expansion. First deliver a reproducible staging deployment and verified account isolation, truthful privacy/deletion, secure usage controls and one dependable Arabic planning journey. Release the controlled pilot only when those gates pass; then validate willingness to pay before broad launch.
