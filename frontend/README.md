# Deductly — Frontend

React 18 + TypeScript + Vite single-page app. Talks to the backend at `VITE_API_BASE_URL`, stores nothing, no account.

## Prerequisites

- Node.js 20+
- A running backend (see [`backend/README.md`](../backend/README.md)) or a `VITE_API_BASE_URL` pointing at a deployed one

## Quick start

```bash
cd frontend

# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env.local
# Edit .env.local — VITE_API_BASE_URL=http://localhost:8000

# 3. Dev server
npm run dev
```

The app is then on `http://localhost:3000` with Vite's hot-reload. The dev server proxies `/api/*` to `http://localhost:8000` (see [`vite.config.ts`](vite.config.ts)), so CORS is a non-issue during local development.

## Tests

```bash
# Unit + integration (Vitest + React Testing Library) — ~170 tests
npm test
npm test -- --coverage           # with coverage

# End-to-end (Playwright) — ~30 specs across chromium/mobile/tablet
npx playwright test                                 # full matrix
npx playwright test --project=chromium              # faster, one browser
npx playwright test --ui                            # interactive watch mode
PLAYWRIGHT_BASE_URL=https://staging.example.com \
  npx playwright test                               # run against a deployed target
```

Playwright auto-starts `npm run dev` when `PLAYWRIGHT_BASE_URL` is a localhost URL (the default). For deployed targets it skips the webServer and hits the URL directly.

## Build

```bash
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # serve dist/ locally to smoke-test the production bundle
```

`npm run build` fails the build on any TypeScript error.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL. Injected at build time; not available at runtime. |

## Project layout

```
frontend/src/
├── pages/                   # Landing, Upload, Report, Rules, Privacy, Terms
├── components/              # Navigation, Button, Card, Chip, Drawer, AnimatedSection, Icon
├── api/
│   ├── client.ts            # Axios instance + APIError + upload/status/download helpers
│   └── hooks.ts             # React Query hooks (useUploadCSV, useJobStatus, download)
├── styles/design-system.css # Playfair Display + Space Mono + DM Sans
├── hooks/useParallax.ts
└── test/setup.ts            # Vitest mocks: IntersectionObserver, ResizeObserver, matchMedia, shaders-react
```

```
frontend/tests/
├── e2e/                     # Playwright specs (landing, upload, navigation, responsive)
└── pages/                   # Page Object Model for e2e
```

## Design system

- **Display:** Playfair Display (serif) — headlines, hero
- **Body:** DM Sans — everything readable
- **Mono:** Space Mono — labels, numerics, badges
- **Palette:** warm charcoal backgrounds (`ink-900`/`ink-950`), gold accent (`#B8860B` / `#F0C04A`), deliberately no blue. See `tailwind.config.js`.

`AnimatedSection` gates all scroll-triggered animations behind `prefers-reduced-motion` — when the OS setting is on, sections render statically.

## How the frontend talks to the backend

1. User selects a file on `/upload`
2. `useUploadCSV` POSTs multipart/form-data to `/api/upload`, streaming upload progress to the UI
3. Backend (in ephemeral mode) returns the full report inline in the response
4. `/report/:jobId` renders tabs: Likely Deductible · Needs Review · Excluded · Audit Trail
5. PDF/CSV/JSON downloads go through `downloadReport()` in `api/client.ts`

No auth, no cookies, no analytics.

## Deploy

Netlify / Vercel / Cloudflare Pages / static host of choice — see [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
