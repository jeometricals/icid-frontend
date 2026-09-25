# CLAUDE.md

Standing instructions for anyone (human or Claude Code) working in this repo.

## What this repo is

The frontend for ICID (Integrated Construction Information Database), a construction inspection reporting SaaS.
React 18 + Vite + Tailwind + React Router v6, deployed on Vercel. All data comes from the ICID backend API
(`VITE_API_URL`, default `https://icid-backend.vercel.app`) — the frontend never touches the database directly.

Commands: `npm run dev` (port 3000) · `npm test` · `npm run test:coverage` · `npm run build`

## Folder structure

- `src/pages/` — top-level routed pages (login, project selection, project dashboard). One page per file.
- `src/pages/reports/` — inspection report form pages (General, Daily Site Patrol, Curb/Sidewalk).
- `src/contexts/` — React context providers. Currently just `AuthContext.jsx` (hardcoded dev user).
- `src/services/` — all backend access. `api.js` holds every backend call via the shared `apiFetch` helper.
- `src/lib/` — third-party client setup and small utilities. (Contains legacy `supabase.js` — see Known technical debt.)
- `src/data/` — static/mock data (report type definitions, legacy mock `PROJECTS`).
- `src/test/` — global Vitest + React Testing Library setup (`setup.js`).
- `src/components/` — shared UI components. Doesn't exist yet; create it the first time JSX needs sharing.
- Tests live beside the code in `__tests__/` folders (`src/pages/__tests__/`, `src/services/__tests__/`, …).

## Modularity rules

1. **One file, one purpose.** A page component is one page. A service file is one integration area —
   `api.js` = all backend calls; if it grows too large, split by resource (`projects.js`, `reports.js`, `users.js`).
2. **Frontend never calls the database directly.** All data access goes through `src/services/`.
   No Supabase clients or other direct DB access in components.
3. **No `fetch()` inside components.** Every request lives in a service function; components stay
   presentational and import the service function instead of building URLs.
4. **No duplicated JSX.** If the same UI appears in two places, extract a shared component into `src/components/`.
5. **Component names describe what they show or do**, not where they sit (`ProjectInfoCard`, not `TopBox`).
6. **Every non-trivial component has a short docstring comment at the top** (2–3 lines): what it renders and what props it takes.

## Coding conventions

- Functional components with hooks. No class components.
- Tailwind for styling. Reuse the component classes in `src/index.css` (`btn-primary`, `btn-secondary`, `input-field`,
  `input-label`, …) and the `construction-*` palette from `tailwind.config.js`. Inline styles only for dynamic values
  Tailwind classes can't express.
- React Router for navigation (`useNavigate`, `<Navigate>`, `<Link>`), never `window.location`.
- **Any component that fetches data must explicitly handle loading, success, and error states.** No silent
  failures — no `.catch(() => {})`, no mapping every error to "not found". `ProjectSelectionPage.jsx` is the reference pattern.
- New page → matching test under `src/pages/__tests__/` (or `src/pages/reports/__tests__/` for report pages).
  New service function → test in `src/services/__tests__/`.
- Never commit `.env*` files, `node_modules/`, `dist/`, `coverage/`, or `.DS_Store`. Verify `.gitignore` covers
  them and check `git status` before every commit.

## Rules for Claude Code

- **Propose which files you'll change before changing them**, so scope creep gets caught early.
- **Auth is hardcoded on purpose.** `AuthContext.jsx` always signs in as dev user #28, and every current page
  assumes it. Do NOT try to fix auth until we tackle it deliberately as its own slice.
- **New API calls go in the appropriate service file first**, then the component imports them. Never call `fetch` from a component.
- **If a change needs a matching backend change (new endpoint, changed response shape), STOP and tell me.** Don't
  make backend changes from this repo and don't invent endpoints that don't exist yet. Endpoints currently used:
  <!-- Update this list when endpoints change -->
  - `GET /v1/projects/?user_id=`
  - `GET /v1/projects/{id}`
  - `POST /v1/idrs/` · `GET /v1/idrs/?project_id=&reporter_uuid=&status=` · `GET /v1/idrs/{id}`
  - `PUT /v1/idrs/{id}/header` · `POST /v1/idrs/{id}/submit`
  - `POST /v1/idrs/{id}/reports` · `PUT /v1/idrs/{id}/reports/{report_id}` · `DELETE /v1/idrs/{id}/reports/{report_id}`
- **Follow the existing design language** (construction-orange palette, white cards on `bg-gray-50`, `max-w-7xl`
  layout, lucide-react icons) unless we're deliberately reworking it.
- **Mention unrelated bugs you notice, but don't touch them.** Scope creep in fixes hurts more than it helps.

## Known technical debt

- **Supabase code and docs are dead.** The `@supabase/supabase-js` dependency, `src/lib/supabase.js`, and multiple docs
  (README, QUICKSTART, DEPLOYMENT, PROJECT_SUMMARY, TODO.md) still reference Supabase. The real backend is the
  ICID FastAPI at `VITE_API_URL`.
- **README references files that don't exist** (`.env.example`, `src/components/`).
- **`ProjectDashboard` swallows all errors as "not found"** — fix pending Slice 1 work.
- **Fake hardcoded weather** (52°F / 48° / 59°) on multiple pages.
- **`src/data/mockData.js` mixes real config** (`REPORT_TYPES`) **with dead mock data** (`PROJECTS`).
- **No ESLint config** — `npm run lint` will fail.
- **Some pages lack tests** (`LoginPage`, all report pages).
