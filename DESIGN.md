# JOOD AI — Design System

Calm, premium, Saudi. Frosted glass over a dusk sky, in JOOD's espresso, gold and teal.
Tokens live in `src/index.css`; Tailwind names them in `tailwind.config.ts`.

## Color

| Token | Role |
|---|---|
| `--jood-teal-900` (espresso) | Primary actions, active tab, brand anchor |
| `--jood-gold-500 / 300` | Accent, primary button (`.jood-btn-primary`), focus ring |
| `--jood-teal-400 / 500` | Income, positive data, secondary accent |
| `--jood-warn` | Expenses, caution |
| `--jood-ok` | Positive balance, success |
| `--destructive` | Errors and destructive actions only — never as a full panel fill |

Light and dark themes both exist; the app follows the device setting (`defaultTheme="system"`).
Admin, Terms, Privacy and Majlis are always dark (a `dark` class on their root).

## Surfaces

- **`.jood-ambient`** — page backdrop: fixed gold/amber/teal radial light plus a faint girih
  lattice. Put it on the root of every full page.
- **`.glass`** (also applied by `.jood-card` and the shared `Card`) — frosted panel: 32px blur,
  ~0.37 fill, white hairline border, gold inner top edge.
- **`.glass-dense`** — add to glass that floats over busy content (toasts, tooltips, dialogs,
  menus, sheets) so text stays readable.
- Fallbacks are built in: no `backdrop-filter` support → near-opaque; `prefers-reduced-transparency`
  → opaque, no blur.

Rule: never put a solid `bg-card` / `bg-background` / `bg-popover` on a panel — a Tailwind
`bg-*` utility overrides `.glass`. If a primitive sets its own background, wrap it in a glass
element and make it `bg-transparent` (see the dashboard `TabsList`).

## Typography

- Arabic: IBM Plex Sans Arabic (body), Tajawal (display). Use `font-arabic` on Arabic text.
- Latin: Inter (body), Playfair Display (marketing display only).
- Numbers and money: JetBrains Mono (`font-mono`), Latin digits, `dir="ltr"` on the amount.
- No all-caps labels. Gendered Arabic copy goes through `tg()` or a male/female pair.

## Layout and RTL

- Arabic is the default; `useLanguage` sets `<html dir>` and wraps the app in Radix
  `DirectionProvider`, so Tabs, menus and selects lay out right-to-left.
- Use logical utilities: `ps-/pe-`, `ms-/me-`, `start-/end-`, `text-start`. Avoid `left/right`,
  `pl/pr`, `space-x-*` (wrong in RTL) — prefer `gap-*`.
- Sheets open from the reading-end side (`left` in Arabic).
- Mobile: floating glass bottom nav, content padded `pb-28`; tested at 375px.

## Components

| Component | Notes |
|---|---|
| Card / `.jood-card` | Glass, `rounded-2xl`. Icon tile: 36–44px, `bg-<accent>/15`. |
| Buttons | `.jood-btn-primary` (gold pill), `.jood-btn-outline`. Espresso fill for active/selected. |
| Charts (`Dashboard/chartTheme.tsx`, `GlassDonut.tsx`) | Glowing monotone areas with fading fill; segmented glow rings with the total in the centre; shared `PALETTE` and `SERIES`; glass tooltips; per-instance SVG ids via `useChartId`. Cash flow shows the last 6 complete months. |
| Overlays | Dialog, alert dialog, sheet, drawer, popover, menu, select: `glass glass-dense`, backdrop `bg-black/40` + slight blur. |
| Toasts | Glass; errors get a red start edge and red title, not a red block. |
| Problem states | Calm glass card: specific title, plain steps, a retry and a fallback action (see Majlis mic card). Never show raw error text. |
| Empty states | Orb + one sentence + what to do next. |

## Motion

- One orchestrated entrance per screen (cards fade/slide 10–16px, ≤0.5s, ease `[0.22,1,0.36,1]`).
- Data motion only where it explains something (rings fill, chart lines draw once).
- Respect `prefers-reduced-motion` (`useReducedMotion` in framer-motion).

## Accessibility

- Text on glass ≥ 4.5:1 (light-mode muted text measured ~6:1).
- Icon-only buttons need `aria-label`; toggles use `aria-pressed`.
- Visible focus ring (`--ring`, gold). Error cards use `role="alert"`.
