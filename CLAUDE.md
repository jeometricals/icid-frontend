# CLAUDE.md

Standing instructions for anyone (human or Claude Code) working in this repo.

## What this repo is

The frontend for ICID (Integrated Construction Information Database), a construction inspection reporting SaaS.
React 18 + Vite + Tailwind + React Router v6, deployed on Vercel. All data comes from the ICID backend API
(`VITE_API_URL`, default `https://icid-backend.vercel.app`) — the frontend never touches the database directly.

Commands: `npm run dev` (port 3000) · `npm test` · `npm run test:coverage` · `npm run build`

## Folder structure

- `src/pages/` — top-level routed pages (login, project selection, project dashboard, drafts list, report archive, IDR, review queue, project roles, the admin's all-IDRs list). One page per file.
- `src/pages/reports/` — inspection report form pages (General, SWCB, AC, ConcMix, ConcCyl).
- `src/contexts/` — React context providers: `AuthContext.jsx` (the signed-in user; see Sign-in below), `ProjectRolesContext.jsx` (the roles they hold on each project; see Review below), `TaskCountContext.jsx` (how many IDRs are waiting on them), `RedlineContext.jsx` (a field's reviewer edits and the edit calls, for `RedlinedField`; and which IDRs have edit mode on) and `LeaveGuardContext.jsx` (lets a page with unsaved edits stand between the app header and a navigation away; see Navigation below).
- `src/services/` — all backend access. One file per resource (`auth.js`, `signatures.js`, `projects.js`, `idrs.js`, `reviews.js`, `fieldEdits.js`, `idrReports.js`, `users.js`, `attachments.js`, `contractItems.js`, `exports.js`) on the shared `apiFetch` helper; `api.js` re-exports them all.
  Exception: `session.js` holds the session token helpers (`getToken` / `setToken` / `clearToken`, stored in
  `localStorage` under `icid_token`), not backend calls; components get the current user from `useAuth()`.
- `src/lib/` — third-party client setup and small utilities. Holds `reportData.js` (shared form-state helpers), `personName.js` (the name to show for a user), `useReportForm.js` (the hook every report page uses for load/save/state), `reviewRoles.js` (which review queues and actions a user gets), `fieldEdits.js` (reading an IDR's edit history: one field's chain, pay-item paths, "revised after return"), `useReviewEditing.js` (whether the user may edit, edit mode, the edit calls) and `signatureImage.js` (crops a drawn signature to its ink and turns it into the PNG that is uploaded). Also contains the legacy `supabase.js` — see Known technical debt.
- `src/data/` — static/mock data (report type definitions).
- `src/test/` — global Vitest + React Testing Library setup (`setup.js`) and shared test helpers: `mockFetch.js`, `users.js` (`TEST_USER`, `DEMO_USER` and `sessionFor`, shaped as the backend returns them), and `contractItems.js` (a `getContractItems` response fixture for the pay-item picker).
- `src/components/` — shared UI components (`AppLayout` and its `AppHeader` and `UserMenu`, `ProtectedRoute`, `GoToProjectButton`, modals, attachments, IDR report rows, save / submit controls, and the review pieces: `ReviewToolbar`, `AcceptStage1Modal`, `ReturnCommentModal`, `ReturnNotice`, `StatusBadge`, `IDRNumberBadge`, `IdrTable`); `src/components/reports/` holds the report-form sections (including `PayItemsSection` and its catalog `PayItemPicker`), the report page shell and the addendums section.
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
  ICID Co. logo (a link to `/projects`) and the user menu (`UserMenu`: the user's name, opening a dropdown with
  their signature and Sign Out; a new entry is one more object in its `items` list). Pages don't render a header of their own,
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
  - `SignatureSetupModal` is the one place a signature is set or replaced: draw it (`react-signature-canvas`),
    upload a PNG, or type a name and pick one of four handwriting fonts (`SIGNATURE_FONTS`; the fonts are bundled
    through `@fontsource/*`, so nothing is fetched from a font service). A typed signature is rendered to a PNG
    in the browser and saved as `drawn`, like a drawing. `saveSignature` in `services/signatures.js` does the three steps: `upload-request`, a PUT of the
    PNG straight to the signed Storage URL (not through `apiFetch`), then `confirm`. PNG only, 500 KB at most.
  - A drawing or a typed name is cropped to its ink before upload (`lib/signatureImage.js`), so it fills the
    signature line on the printed form. A typed signature waits for its font to load and refuses to save in a
    fallback font.
  - On the IDR page, Submit opens the modal first for a user without a signature, then the certification dialog
    (which now carries the attestation sentence under the certification statement). The user menu in the header
    has "Set up signature" / "Update signature".
  - **Showing it.** A submitted IDR's page opens with `SignedBanner`: "Submitted by <name> on <date>", from the
    IDR's `inspector_signed_at` in the viewer's time zone. The name is the IDR's reporter: the signed-in user's
    own name when it is their IDR, otherwise looked up in `GET /v1/users/`; `lib/personName.js` gives first and
    last name, else email. An IDR submitted before signatures (no `inspector_signed_at`), or one whose name can't
    be found, reads "Submitted on <date>". In the Archive, `IdrCard` adds a small "Signed" mark when the IDR
    has an `inspector_signature_path`, and nothing for older IDRs (never "Unsigned").
  - Demo users never see any of it: no menu item, and Submit is disabled for them. The backend refuses them
    too (403).
  - Tests don't have a real canvas: they mock `react-signature-canvas`, and pages mock `SignatureSetupModal`.
- **Review.** After an inspector submits, an IDR goes `submitted` → `stage1_review` → `stage2_review` → `approved`;
  a reviewer can send it back (to `draft` for the inspector, or from Stage 2 to `stage1_review` for the OE).
  - **Roles.** `GET /v1/projects/` lists each project once with `roles` (any of `inspector`, `oe`, `re`).
    `ProjectRolesProvider` (inside `AuthProvider` in `App.jsx`) reads that once per sign-in; `useProjectRoles()`
    gives `rolesByProject` (`null` while loading), `error` and `reload()`. Outside a provider the hook gives no
    roles, so a component rendered alone in a test needs none. Admin is `user.role === 'admin'`, not a project role.
  - `lib/reviewRoles.js` decides what to show: `reviewQueuesFor(user, rolesByProject)` (Stage 1 for an OE or RE,
    Stage 2 for an RE, both for an admin) and `reviewActionsFor(idr, user, roles)`. Only the reviewer who accepted
    an IDR at a stage can approve or return it there; an admin can stand in. The backend enforces all of it, so
    these only hide what would be refused.
  - **`/review`** (`ReviewQueuePage`, "My Tasks" in the user menu for anyone with a queue): one tab per queue.
    Stage 1 merges the `submitted` and `stage1_review` queues. An IDR opened from it carries
    `state.from = 'review'`, so the IDR page's Back returns there.
  - **On the IDR page**, the title carries `StatusBadge` and `IDRNumberBadge`; `ReviewToolbar` sits under the
    submitted banner and runs the review calls itself, then asks the page to refetch. Accepting at Stage 1 asks
    for the IDR # (`AcceptStage1Modal`) unless the IDR already has one; a 409 there links to the IDR that holds
    the number. Every return goes through `ReturnCommentModal` (comment required). Approving at Stage 2 signs,
    so a reviewer without a signature sets one up first. An IDR with a `return_reason` shows `ReturnNotice`.
  - Every status but `draft` is read-only, for everyone: there are no reviewer or admin edits yet.
  - **Wording.** The page and menu item are "My Tasks" (the route stays `/review`); the tabs are "IDR Check Queue"
    and "RE Review Queue"; the buttons are "Accept Task - IDR Check", "Approve → RE Review", "Accept for RE Review"
    and "Final Approve & Sign". The status badges read "IDR Check" / "RE Review",
    and a return notice "Returned from IDR Check" / "Returned from RE Review". Only the displayed text changed: the
    keys (`stage1_review`, `stage2_review`, `stage1`, `stage2`) are the backend's.
  - **At Stage 2 the only button is "Accept for RE Review"** until the signed-in user is the IDR's
    `re_reviewer_uuid`; then it gives way to "Final Approve & Sign", "Return to OE" and "Return to Inspector".
    That holds for an admin too.
  - **Task count.** `TaskCountProvider` (inside `ProjectRolesProvider`) counts the IDRs the user can act on right
    now (`isTaskFor` in `lib/reviewRoles.js`) from the same three `GET /v1/idrs/queue` calls the page makes:
    once when their roles are known, and whenever `refresh()` is called. `ReviewToolbar` calls it after every
    action and the IDR page after a submit. `useTaskCount()` gives `{submitted, stage1_review, stage2_review,
    total, error, refresh}`. `UserMenu` shows a red dot on the name while `total > 0` and the number beside
    "My Tasks" (`countBadgeText`: hidden at 0, "99+" past 99). Nothing polls, so a task created by someone
    else shows up at the next sign-in, reload or action.
  - **The Archive** is a table (`IdrTable`, shared with the queue) of every IDR past draft, sorted by work date,
    with names from the list itself (`reporter_name`, `stage1_reviewer_name`, `re_reviewer_name`); it no longer
    calls `GET /v1/users/`. No filters yet.
- **Reviewer edits (redlines).** While an IDR is in review, the reviewer who accepted it at its current stage (or
  an admin) can change its fields. The backend applies each edit and logs it, so the IDR and its reports always
  hold the current values and `field_edits` (on `GET /v1/idrs/{id}`, oldest first) is their history.
  - **`RedlinedField`** wraps a field's normal control and reads a `RedlineProvider` around it. With no provider,
    or no edits and no edit mode, it renders just the control. With edits it draws the redline in the control's
    place: the original struck through, then each edit's value in blue (`#0070C0`) with its editor's initials.
    When the current value differs from the last edit's, it adds the value with "Inspector revised after
    return" (no initials: the inspector's saves are not logged).
  - **Edit mode** (`EditModeToggle`, on the IDR page and on a report page) is off by default, per IDR, and carries
    across its pages (`EditModeProvider` in `App.jsx`). On, each `RedlinedField` shows a pencil on hover or
    focus; it opens an inline input with Save / Cancel. `lib/reviewRoles.js` `canEditInReview` decides who gets
    the switch; the backend enforces it.
  - **The form's own inputs stay disabled in review.** In edit mode the page's `<fieldset disabled>` lets go so
    the inline editors work, and each section's `disabled` prop keeps its inputs off. A section rendered inside
    a report page must therefore honour `disabled`.
  - **Pay items past draft** are drawn by `PayItemsReview`, not the form table: rows of text; an item whose
    quantity was revised keeps its row with the quantity crossed out and gets a blue row per revision with the
    reviser's initials; an added item is a blue row with the adder's initials. In edit mode each item has Revise
    (`RevisePayItemModal`, a number) and the table has Add Pay Item (`AddPayItemModal`: pick from the catalog or
    enter by hand). Every call uses the item's `id`, never its position.
  - **Trucks a reviewer adds (Conc Mix).** In edit mode Add Truck on `ConcMixTrucksTable` is the reviewer's: it
    opens a blank row with Save / Cancel under the table (Save needs a truck or ticket number or a slump, as the
    backend does) and posts the truck in the keys the report stores. The backend gives it an `id` and logs
    `truck_add` on `trucks[<truck id>]`; `truckAddEdit` in `lib/fieldEdits.js` finds that, and such a truck is a
    blue row with the adder's initials after its ticket number. Its cells are still addressed by position and
    take later edits like any other truck's. A reviewer never removes a truck. Every truck carries its `id` once
    the IDR was submitted, and a draft save sends it back (the form keeps whatever keys a saved truck has).
  - **A lost race** (409) shows the toast "Someone else edited this field — reloading" and refetches the IDR.
    Any other refusal shows under the input, which stays open.
  - **Which fields have it:** the eight header fields; and on every report the description, comments / remarks,
    workforce (added trades included), equipment (added equipment included), the safety checklist with its
    remarks, and pay items; every Conc Mix section, by the keys the report stores (`locationOfUse.curb`,
    `mixerType.type`, `mixerType.otherLabel`, `trucks[0].slump`, `concreteSpecs.slumpMin`,
    `materialUsage.batchReportNo`, `remarks`); and SWCB's own sections (`structural`, `subcontractor`,
    `activity.excavation.fromStation`, `inspectionMatrix.subgradeCompacted.sidewalk`,
    `inspectionMatrix.otherCuringMethods.base`), except the matrix cells the form greys out, which take no edits.
    **The other report-specific sections do not yet**: AC's eight sections; Conc Cyl's own sections (they wait for the
    Conc Cyl form and export slice). They show as before and can't be edited by a reviewer. Giving one of them
    redlines is a `RedlinedField` around each input with its path.
  - **A checkbox or radio group** keeps its own (disabled) control and gets a childless `RedlinedField` beside it
    with `type="select"`: its options hold the stored values (`'true'` / `'false'` with `toRequest` back to a
    boolean, `readyMix` / `other`, `Y` / `N` / `NA`) and `format` gives how one reads. The select opens on the
    stored value.
  - **On a returned draft** the form's inputs are live and each field's history reads under it. The draft's
    pay-item table is the normal form; its pay-item history isn't shown there.
  - Lists other than pay items are addressed by position (`additionalWorkforce[0].count`), which the backend
    notes as a known limitation once a returned draft's rows are reordered.
- **Project roles (admin).** `/admin/projects/:projectId/roles` (`ProjectRolesPage`), reached from "Manage Roles"
  on the project dashboard, which only an admin sees. One row per user and role with Revoke (confirmed first; it
  warns when it is the user's only role there, since that takes them off the project), and an "Add role" row: any
  user from `GET /v1/users/`, a role, Grant. Both calls answer with the project's roles as they now stand, and
  both are safe to repeat (granting a role already held is a success). A failed change shows inline and leaves the
  table alone. When an admin changes their own roles the page reloads `ProjectRolesContext` and the task count.
  A non-admin who opens the URL is told it is for admins; the backend returns 403 to them anyway.
- **All IDRs (admin).** `/admin/idrs` (`AdminIdrsPage`), "All IDRs (Admin)" in the user menu, which only an admin
  sees. One `GET /v1/idrs/` with `include_deleted=true&include_all_drafts=true` and no project; the "Show deleted"
  and "Show all drafts" toggles (both off to start) only filter what was fetched. `IdrTable` with its optional
  `sort` / `onSort` (work date by default, submit date, status) and `renderActions`. Each row has "Soft-delete"
  and, for `ADMIN_UNLOCKABLE_STATUSES` in `lib/reviewRoles.js` (`approved`, `stage2_review`: what the backend
  accepts), "Unlock"; a deleted IDR (`status === 'deleted'`) shows a Deleted badge instead. Both are confirmed
  first, a refusal shows in the dialog, and after a success the page reads the list again rather than patching
  the row, then refreshes the task count. Rows don't open the IDR page. A non-admin who opens the URL is told it
  is for admins; the backend returns 403 / 400 to them anyway.
- **Pay-item approval (the stage gate).** The backend only approves a stage (`approve-stage1`, `approve-stage2`)
  once the user approving has attested to every pay item on every report but an auto-generated General: approved
  it, revised its quantity or added it, at this stage, since the stage was last accepted, for the quantity it has now. Otherwise it answers 400 with
  `{detail, untouched: [{pay_item_id, report_id, item_no, budget_code}]}`.
  - **`lib/fieldEdits.js`** mirrors the rule: `payItemAttestations`, `isPayItemTouched` and `untouchedPayItems`
    read it from `field_edits` (an approval is `edit_type: 'pay_item_approve'` on `payItems[<id>]`, the quantity as
    both `old_value` and `new_value`). `useReviewEditing` gives `approve(itemId)` and `attesting`
    (`{userUuid, stage, acceptedAt}`, null for anyone but the stage's reviewer or an admin).
  - **On a report page** (`PayItemsReview`) the stage's reviewer has an Approve button on each item they haven't
    touched, edit mode or not (Revise and Add Pay Item still need edit mode); it posts and takes the IDR from the
    response. So the shell's fieldset lets go for that reviewer, not only in edit mode. Approvers' initials sit
    beside the current quantity (each reviewer's latest at each stage); one for a quantity the item no longer
    has is greyed and struck, with the tooltip "Approval superseded — re-approve or revise to attest."
  - **Approve All** sits above the table for that reviewer while the report has an item they haven't touched. It
    posts the same approve call for each such item, one after another (each response's IDR is taken before the
    next call), with no confirmation; the button reads "Approving..." meanwhile. It stops at the first refusal
    with a toast naming the item, and does not retry.
  - **On the IDR page** the two approve buttons in `ReviewToolbar` carry "N un-approved items" and stay enabled:
    the backend is the gate. On its 400 the toolbar toasts the detail, and the page opens the report holding the
    first untouched item with `state.payItemGate = {itemId, message}`; `useReportForm` passes that on, the shell
    toasts the message and the item's row is outlined and scrolled into view.
  - **Rounds.** Every IDR response carries `stage1_accepted_at` and `stage2_accepted_at`. An attestation counts
    only if its `edited_at` is at or after its stage's accepted time (`stageAcceptedTimes(idr)`, passed as
    `acceptedAt`), so an IDR that was returned and accepted again is attested to afresh, and the count is right
    on first paint. A null accepted time means no round filter: every attestation at that stage counts (the
    quantity rule still applies). An approval from an earlier round is greyed and struck like a superseded one.
- **New API calls go in the appropriate service file first**, then the component imports them. Never call `fetch` from a component.
- **If a change needs a matching backend change (new endpoint, changed response shape), STOP and tell me.** Don't
  make backend changes from this repo and don't invent endpoints that don't exist yet. Endpoints currently used:
  <!-- Update this list when endpoints change -->
  - `POST /v1/auth/login` · `POST /v1/auth/demo` · `GET /v1/auth/me` · `POST /v1/auth/logout`
  - `POST /v1/signatures/upload-request` · `POST /v1/signatures/confirm` (the PNG itself is PUT to the Storage signed URL)
  - `GET /v1/projects/` (the signed-in user's projects, each with `roles`)
  - `GET /v1/projects/{id}`
  - `GET /v1/projects/{id}/roles` · `POST /v1/projects/{id}/roles` (admin only: list, grant and revoke project roles)
  - `GET /v1/users/` (the IDR page's banner resolves reporter_uuid → name; the roles page lists who can be given a role; not available to demo users)
  - `POST /v1/idrs/` · `GET /v1/idrs/?project_id=&reporter_uuid=&status=` (plus `include_deleted=` and
    `include_all_drafts=`, admin only) · `GET /v1/idrs/{id}`
  - `PUT /v1/idrs/{id}/header` · `POST /v1/idrs/{id}/submit`
  - Review: `GET /v1/idrs/queue?status=` · `POST /v1/idrs/{id}/accept-stage1` · `POST /v1/idrs/{id}/approve-stage1` ·
    `POST /v1/idrs/{id}/accept-stage2` · `POST /v1/idrs/{id}/approve-stage2` · `POST /v1/idrs/{id}/return`
  - Reviewer edits: `PATCH /v1/idrs/{id}/field` · `POST /v1/idrs/{id}/pay-items/{item id}/revise` ·
    `POST /v1/idrs/{id}/pay-items/add` ·
    `POST /v1/idrs/{id}/pay-items/{item id}/approve` ·
    `POST /v1/idrs/{id}/reports/{report_id}/trucks/add` (each returns the IDR with `field_edits`, as `GET /v1/idrs/{id}` does)
  - Admin: `POST /v1/idrs/{id}/admin/unlock` · `POST /v1/idrs/{id}/admin/delete` (a soft delete)
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
