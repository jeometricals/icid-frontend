# CLAUDE.md

Standing instructions for anyone (human or Claude Code) working in this repo.

## What this repo is

The frontend for ICID (Integrated Construction Information Database), a construction inspection reporting SaaS.
React 18 + Vite + Tailwind + React Router v6, deployed on Vercel. All data comes from the ICID backend API
(`VITE_API_URL`, default `https://icid-backend.vercel.app`) — the frontend never touches the database directly.

Commands: `npm run dev` (port 3000) · `npm test` · `npm run test:coverage` · `npm run build`

## Folder structure

- `src/pages/` — top-level routed pages (login, project selection, project dashboard, drafts list, report archive, IDR). One page per file.
- `src/pages/reports/` — inspection report form pages (General, SWCB, AC, ConcMix, ConcCyl).
- `src/contexts/` — React context providers: `AuthContext.jsx` (the signed-in user; see Sign-in below) and `LeaveGuardContext.jsx` (lets a page with unsaved edits stand between the app header and a navigation away; see Navigation below).
- `src/services/` — all backend access. One file per resource (`auth.js`, `signatures.js`, `projects.js`, `idrs.js`, `idrReports.js`, `users.js`, `attachments.js`, `contractItems.js`, `exports.js`) on the shared `apiFetch` helper; `api.js` re-exports them all.
  Exception: `session.js` holds the session token helpers (`getToken` / `setToken` / `clearToken`, stored in
  `localStorage` under `icid_token`), not backend calls; components get the current user from `useAuth()`.
- `src/lib/` — third-party client setup and small utilities. Holds `reportData.js` (shared form-state helpers), `useReportForm.js` (the hook every report page uses for load/save/state) and `signatureImage.js` (crops a drawn signature to its ink and turns it into the PNG that is uploaded). Also contains the legacy `supabase.js` — see Known technical debt.
- `src/data/` — static/mock data (report type definitions).
- `src/test/` — global Vitest + React Testing Library setup (`setup.js`) and shared test helpers: `mockFetch.js`, `users.js` (`TEST_USER`, `DEMO_USER` and `sessionFor`, shaped as the backend returns them), and `contractItems.js` (a `getContractItems` response fixture for the pay-item picker).
- `src/components/` — shared UI components (`AppLayout` and its `AppHeader`, `ProtectedRoute`, `GoToProjectButton`, modals, attachments, IDR report rows, save / submit controls); `src/components/reports/` holds the report-form sections (including `PayItemsSection` and its catalog `PayItemPicker`), the report page shell and the addendums section.
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
- **Navigation.** Every signed-in page renders inside `AppLayout` (`App.jsx`), which supplies the app header: the
  ICID Co. logo (a link to `/projects`), the user's name and Sign Out. Pages don't render a header of their own,
  and size their root with `flex-1` (the layout owns the screen height), not `min-h-screen`.
  - A page deep inside a project shows `GoToProjectButton` beside its Back button, unless Back already goes to the
    project page.
  - Report forms save unsaved edits before any exit (`form.navigateSafely`). `ReportPageShell` registers that as
    the page's leave guard (`useLeaveGuard`), and the header runs the logo and Sign Out through it
    (`useGuardedLeave`). A new page with edits worth keeping registers a guard the same way; a new exit in the
    header goes through `useGuardedLeave`.
- **Any component that fetches data must explicitly handle loading, success, and error states.** No silent
  failures — no `.catch(() => {})`, no mapping every error to "not found". `ProjectSelectionPage.jsx` is the reference pattern.
- New page → matching test under `src/pages/__tests__/` (or `src/pages/reports/__tests__/` for report pages).
  New service function → test in `src/services/__tests__/`.
- Never commit `.env*` files, `node_modules/`, `dist/`, `coverage/`, or `.DS_Store`. Verify `.gitignore` covers
  them and check `git status` before every commit.

## Rules for Claude Code

- **Propose which files you'll change before changing them**, so scope creep gets caught early.
- **Sign-in.** The backend requires a bearer token on every `/v1` route except login, demo and logout.
  - `AuthContext` holds `user` (`{uuid, email, first_name, last_name, role, is_demo}`), `isLoading`, `error`, and
    `login(email, password)`, `loginDemo()`, `logout()`. On startup it restores the session from the stored token
    with `GET /v1/auth/me`. It must sit inside the Router (it navigates on sign-out).
  - `apiFetch` adds `Authorization: Bearer <token>` to every request. A 401 clears the token and fires
    `UNAUTHORIZED_EVENT`; `AuthContext` then signs the user out and sends them to `/login`. The caller's promise
    never settles, so pages show no error on the way out. Only the calls in `services/auth.js` opt out
    (`redirectOn401: false`), because a 401 there means wrong credentials or a stale token.
  - Every route except `/login` sits inside `<ProtectedRoute>` in `App.jsx`; a new page goes there too.
  - **The user never goes in a URL or a request body.** The backend takes the project list's user, an IDR's
    reporter and an attachment's uploader from the token. `?reporter_uuid=` on the IDR list is only a filter.
  - **Demo mode.** "Try Demo Mode" makes a throwaway user (`user.is_demo`) on the demo project. For them: the header
    shows a Demo Mode badge; Sign Out asks first, because it deletes everything they made (`logout()` calls the
    backend for a demo user only); Submit on the IDR page is disabled with a tooltip and a note; the archive skips
    the user list. The backend enforces all of this itself (403 on submit and on `/v1/users/`, 404 on anything
    that isn't theirs), so a new demo restriction needs the backend change first.
  - Tests mock `useAuth()` with `TEST_USER` (has a signature), `UNSIGNED_USER` or `DEMO_USER` from `src/test/users.js`.
- **Signatures.** Submitting an IDR signs it with the user's signature, which the backend stamps on the export.
  - `user.has_signature` and `user.signature_set_at` come with the user; `refreshUser()` on `AuthContext` re-reads
    them after a change.
  - `SignatureSetupModal` is the one place a signature is set or replaced: draw it (`react-signature-canvas`) or
    upload a PNG. `saveSignature` in `services/signatures.js` does the three steps: `upload-request`, a PUT of the
    PNG straight to the signed Storage URL (not through `apiFetch`), then `confirm`. PNG only, 500 KB at most.
  - A drawing is cropped to its ink before upload (`lib/signatureImage.js`), so it fills the signature line on
    the printed form.
  - On the IDR page, Submit opens the modal first for a user without a signature, then the certification dialog
    (which now carries the attestation sentence under the certification statement). The header has a
    "Set up signature" / "Update signature" button.
  - Demo users never see any of it: no header button, and Submit is disabled for them. The backend refuses them
    too (403).
  - Tests don't have a real canvas: they mock `react-signature-canvas`, and pages mock `SignatureSetupModal`.
- **New API calls go in the appropriate service file first**, then the component imports them. Never call `fetch` from a component.
- **If a change needs a matching backend change (new endpoint, changed response shape), STOP and tell me.** Don't
  make backend changes from this repo and don't invent endpoints that don't exist yet. Endpoints currently used:
  <!-- Update this list when endpoints change -->
  - `POST /v1/auth/login` · `POST /v1/auth/demo` · `GET /v1/auth/me` · `POST /v1/auth/logout`
  - `POST /v1/signatures/upload-request` · `POST /v1/signatures/confirm` (the PNG itself is PUT to the Storage signed URL)
  - `GET /v1/projects/` (the signed-in user's projects)
  - `GET /v1/projects/{id}`
  - `GET /v1/users/` (Archive resolves reporter_uuid → name; not available to demo users)
  - `POST /v1/idrs/` · `GET /v1/idrs/?project_id=&reporter_uuid=&status=` · `GET /v1/idrs/{id}`
  - `PUT /v1/idrs/{id}/header` · `POST /v1/idrs/{id}/submit`
  - `POST /v1/idrs/{id}/reports` · `PUT /v1/idrs/{id}/reports/{report_id}` · `DELETE /v1/idrs/{id}/reports/{report_id}`
  - Attachments, under `/v1/idrs/{id}/reports/{report_id}/attachments`: `POST /upload-request` · `POST /upload-complete` ·
    `GET` (list) · `GET /{attachment_id}/download-url` · `PUT /{attachment_id}` · `DELETE /{attachment_id}`
    (the file itself is PUT straight to the Storage signed URL from upload-request, not to the API)
  - `GET /v1/contract_items/?project_id=` (the project's pay-item catalog, for the pay-item picker)
- **Follow the existing design language** (construction-orange palette, white cards on `bg-gray-50`, `max-w-7xl`
  layout, lucide-react icons) unless we're deliberately reworking it.
- **Mention unrelated bugs you notice, but don't touch them.** Scope creep in fixes hurts more than it helps.

## Known technical debt

- **Supabase code and docs are dead.** The `@supabase/supabase-js` dependency, `src/lib/supabase.js`, and multiple docs
  (README, QUICKSTART, DEPLOYMENT, PROJECT_SUMMARY, TODO.md) still reference Supabase. The real backend is the
  ICID FastAPI at `VITE_API_URL`.
- **README's Project Structure tree is outdated** — it lists only three pages and omits `src/services/`, `src/data/` and `src/test/`.
- **`ProjectDashboard` swallows all errors as "not found"** — fix pending Slice 1 work.
- **No ESLint config** — `npm run lint` will fail.
