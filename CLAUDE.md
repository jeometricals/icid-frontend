# CLAUDE.md

Standing instructions for anyone (human or Claude Code) working in this repo.

## What this repo is

The frontend for ICID (Integrated Construction Information Database), a construction inspection reporting SaaS.
React 18 + Vite + Tailwind + React Router v6, deployed on Vercel. All data comes from the ICID backend API
(`VITE_API_URL`, default `https://icid-backend.vercel.app`) — the frontend never touches the database directly.

Commands: `npm run dev` (port 3000) · `npm test` · `npm run test:coverage` · `npm run build`

## Folder structure

- `src/pages/` — top-level routed pages (login, project selection, project dashboard, drafts list, report archive, progress, IDR, review queue, project roles, and the admin's all-IDRs, all-users and all-projects lists). One page per file.
- `src/pages/reports/` — inspection report form pages (General, SWCB, AC, ConcMix, ConcCyl).
- `src/contexts/` — React context providers: `AuthContext.jsx` (the signed-in user; see Sign-in below), `ProjectRolesContext.jsx` (the roles they hold on each project; see Review below), `TaskCountContext.jsx` (how many IDRs are waiting on them), `RedlineContext.jsx` (a field's reviewer edits and the edit calls, for `RedlinedField`; and which IDRs have edit mode on) and `LeaveGuardContext.jsx` (lets a page with unsaved edits stand between the app header and a navigation away; see Navigation below).
- `src/services/` — all backend access. One file per resource (`auth.js`, `signatures.js`, `projects.js`, `idrs.js`, `reviews.js`, `fieldEdits.js`, `idrReports.js`, `users.js`, `attachments.js`, `contractItems.js`, `exports.js`, `quantities.js`) on the shared `apiFetch` helper; `api.js` re-exports them all.
  Exception: `session.js` holds the session token helpers (`getToken` / `setToken` / `clearToken`, stored in
  `localStorage` under `icid_token`), not backend calls; components get the current user from `useAuth()`.
- `src/lib/` — third-party client setup and small utilities. Holds `reportData.js` (shared form-state helpers), `personName.js` (the name to show for a user), `useReportForm.js` (the hook every report page uses for load/save/state), `reviewRoles.js` (which review queues and actions a user gets), `fieldEdits.js` (reading an IDR's edit history: one field's chain, pay-item paths, "revised after return"), `useReviewEditing.js` (whether the user may edit, edit mode, the edit calls), `listOrigin.js` (which list opened an IDR, carried in router state), `progressRollup.js` (the Progress page's grouping and number format) and `signatureImage.js` (crops a drawn signature to its ink and turns it into the PNG that is uploaded). Also contains the legacy `supabase.js` — see Known technical debt.
- `src/data/` — static/mock data (report type definitions, and `disciplines.js`: the discipline names the archive filters by).
- `src/test/` — global Vitest + React Testing Library setup (`setup.js`) and shared test helpers: `mockFetch.js`, `users.js` (`TEST_USER`, `DEMO_USER` and `sessionFor`, shaped as the backend returns them), and `contractItems.js` (a `getContractItems` response fixture for the pay-item picker).
- `src/components/` — shared UI components (`AppLayout` and its `AppHeader` and `UserMenu`, `ProtectedRoute`, `GoToProjectButton`, modals, attachments, IDR report rows, save / submit controls, and the review pieces: `ReviewToolbar`, `AcceptStage1Modal`, `ReturnCommentModal`, `ReturnNotice`, `StatusBadge`, `IDRNumberBadge`, `IdrTable`, and the archive's `ArchiveFilters`); `src/components/reports/` holds the report-form sections (including `PayItemsSection` and its catalog `PayItemPicker`), the report page shell and the addendums section.
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
  their signature, Change password and Sign Out; a new entry is one more object in its `items` list). Pages don't render a header of their own,
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
    `UNAUTHORIZED_EVENT`; `AuthContext` then signs the user out and sends them to
    `/login?returnTo=<path and query string they were on>`, with "Your session has expired". The caller's promise
    never settles, so pages show no error on the way out. Only the calls in `services/auth.js` opt out
    (`redirectOn401: false`), because a 401 there means wrong credentials or a stale token.
    - This is the one place a 401 is handled. Every backend call goes through `apiFetch`, so a new service
      function gets it for nothing; a page never checks for 401 itself.
    - **After signing in again** `LoginPage` goes to `returnTo`, else to the page `ProtectedRoute` remembered
      (`state.from`), else `/projects`. `returnTo` is only followed when it is a path in this app (it starts
      with one `/`, and isn't `/login`). Sign Out carries no `returnTo`.
    - When several requests fail together, the first one sets `returnTo` and the rest change nothing.
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
    calls `GET /v1/users/`.
    - **Filters** (`ArchiveFilters`, above the table): an IDR # box (the start of the number, any case; it
      filters 300 ms after the last keystroke), a work date or a from / to range, and a checkbox per
      discipline. The backend does the filtering: `listIdrs` takes `idrNumber`, `workDate`, `from`, `to` and
      `disciplines`. The page still drops drafts and sorts by work date itself.
    - **Work date and range exclude each other.** Setting a work date clears from and to, and setting either
      bound clears the work date, quietly, because the backend refuses both together (400). Either bound works
      alone. The pickers limit each other (`min` / `max`); a range typed backwards is still the backend's 400.
    - **The disciplines** are the six names in `src/data/disciplines.js`, spelled exactly as the backend's
      mapping has them; it refuses any other spelling with a 400. A new discipline there needs adding here.
    - **The URL holds the filters** (`useSearchParams`), under the backend's own names: `?idr_number=`,
      `?work_date=`, `?from=`, `?to=` and a `?discipline=` per ticked discipline. The page keeps no filter state
      of its own: it reads the query string, and every change writes it, so a filtered view can be linked,
      reloaded and gone back to. Typing replaces the history entry; every other change adds one. This is the
      convention for a list page with filters.
    - A URL the backend refuses (edited by hand) shows the usual error with the backend's message; Clear
      filters is still there. Filters that leave nothing read "No submitted IDRs match these filters."
    - **Chips.** Each row lists the IDR's `disciplines` (alphabetical, as the backend sends them) under its
      IDR #. `IdrTable` shows them only with `showDisciplines`, which the archive alone passes; the queue and
      the admin list get the same field and leave it out.
    - **Back from an IDR returns to the filtered view.** The archive opens an IDR with
      `state: { from: 'archive', archiveSearch }`, and `listOrigin` (`lib/listOrigin.js`) hands both on with
      every navigation between the IDR page, its reports and their addendums. A new navigation among those
      pages passes `listOrigin(location)` as its state.
- **Progress.** `/project/:projectId/progress` (`ProgressPage`), the "Progress" tile on the project dashboard: the
  pay-item quantities of the project's approved IDRs over a range of work dates.
  - **One call:** `listQuantities({ projectId, from, to })` in `services/quantities.js`, which is
    `GET /v1/projects/{id}/quantities` and returns `{rows, totals_by_unit, row_count, truncated}`. The route's
    other filters (pay item, budget code, discipline, inspector) aren't used yet. It answers 403 to a user who
    isn't on the project; the page shows that like any other failure, with Retry.
  - **The range is in the URL** (`?from=&to=`, the archive's convention), written with `replace` so picking dates
    doesn't pile up history. A bare URL means the last 30 days (`DEFAULT_RANGE_DAYS`), by the viewer's own
    calendar (`date-fns`, never `toISOString()`, which is UTC's day), and is left bare, so a link without dates
    always means "the latest 30 days". A URL naming either bound is taken as it stands: a cleared picker is an
    open bound, and clearing both is the default again.
  - **From after To** shows a red hint under the pickers, hides the results and asks the backend nothing.
  - **No totals per unit.** The response's `totals_by_unit` isn't shown: a sum across unrelated pay items that
    share a unit means nothing.
  - **The table is rolled up here** (`rollupByItem` in `lib/progressRollup.js`): one row per item number, budget
    code and unit, its amounts summed. Rows with no item number (a reviewer can add an item by description
    alone) are grouped by description as well, so unrelated ones don't merge. A group shows the first
    description it has. Sorted by item number as numbers (`4.13` before `10.02`), items without one last.
  - **Numbers** print with thousands separators and three decimals at most (`formatQuantity`).
  - **Truncated.** When the response says `truncated` (more than 10,000 rows matched), a banner above the table
    says the view is of the first 10,000; the table is then totals of those rows only.
  - No comparison with contract quantities, no export and no breakdown by inspector or day yet.
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
  - **Conc Cyl cylinders.** The form (`ConcCylMetadata`, `ConcCylCylindersTable`, `ConcCylFooter`) saves
    `deliveryCasting.*`, `sheetNo`, `sheetOf`, `placementLocation` and `cylinders[]` (`class`, `cylinderNo`,
    `slump`; 18 rows at most; the lab's five columns are disabled placeholders and are never stored). The backend
    gives each cylinder an `id` at submit, and a draft save must send it back unchanged: the page keeps whatever
    keys a saved cylinder has, and a new row has no `id`. The testing lab's details are not entered in ICID.
    In review a cylinder's class, number and slump are addressed by that `id`, not by position; a cylinder with
    no `id` gets no pencil and a tooltip saying why. The lab columns never take edits.
  - **A lost race** (409) shows the toast "Someone else edited this field — reloading" and refetches the IDR.
    Any other refusal shows under the input, which stays open.
  - **Which fields have it:** the eight header fields; and on every report the description, comments / remarks,
    workforce (added trades included), equipment (added equipment included), the safety checklist with its
    remarks, and pay items; every Conc Mix section, by the keys the report stores (`locationOfUse.curb`,
    `mixerType.type`, `mixerType.otherLabel`, `trucks[0].slump`, `concreteSpecs.slumpMin`,
    `materialUsage.batchReportNo`, `remarks`); and SWCB's own sections (`structural`, `subcontractor`,
    `activity.excavation.fromStation`, `inspectionMatrix.subgradeCompacted.sidewalk`,
    `inspectionMatrix.otherCuringMethods.base`), except the matrix cells the form greys out, which take no edits;
    and AC's own sections (`pavingContractor.riceNo`, `temperature.surfaceStart`, `maxDensity.top`,
    `pavementCourses[0].width`, `materialUsageTop.qtyUsed`, `materialUsageBinder.qtyUsed`,
    `acRequirements.subgradeCompacted.value` and `.remarks`, `tackCoat.noOfGallons`,
    `deliveryTickets[0].temperature`); and Conc Cyl's own (`deliveryCasting.cyPoured`, `sheetNo`, `sheetOf`,
    `placementLocation`, `cylinders[<cylinder id>].slump`). A reviewer can't add a pavement course, a delivery
    ticket or a cylinder (only a truck). Every report-specific section now has it; giving a new one
    redlines is a `RedlinedField` around each input with its path.
  - **A checkbox or radio group** keeps its own (disabled) control and gets a childless `RedlinedField` beside it
    with `type="select"`: its options hold the stored values (`'true'` / `'false'` with `toRequest` back to a
    boolean, `readyMix` / `other`, `Y` / `N` / `NA`) and `format` gives how one reads. The select opens on the
    stored value.
  - **On a returned draft** the form's inputs are live and each field's history reads under it. The draft's
    pay-item table is the normal form; its pay-item history isn't shown there.
  - Lists other than pay items and Conc Cyl cylinders are addressed by position (`additionalWorkforce[0].count`), which the backend
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
  the row, then refreshes the task count. Unlock on an IDR in RE Review that no RE has accepted (no
  `re_reviewer_uuid`) sends nothing and shows the toast "Already unlocked — IDR is in RE Review"; once an RE has
  accepted it, Unlock still asks and goes through, since that takes the IDR off them. Rows don't open the IDR page. A non-admin who opens the URL is told it
  is for admins; the backend returns 403 / 400 to them anyway.
- **All Users (admin).** `/admin/users` (`AdminUsersPage`), "All Users (Admin)" in the user menu, which only an
  admin sees. One `GET /v1/admin/users` (`listAdminUsers` in `services/users.js`), shown in the backend's order:
  email, first name, last name, role (`Admin` for `role === 'admin'`, `Demo` for a demo user, otherwise
  `Regular`) and a tick for a signature. Each row's "Edit" opens `EditUserModal` with both names filled in; Save
  sends only the names that changed (`patchAdminUser`, `PATCH /v1/admin/users/{id}`) and is off until one has.
  A name can't be cleared, so emptying one that was set is an inline error and nothing is sent. A refusal shows
  in the dialog; after a success the page reads the list again, and re-reads the signed-in user (`refreshUser`)
  when the admin renamed themselves. An existing user's email, role and demo status aren't editable here.
  "Create user" (right of the heading) opens `CreateUserModal`: email, first name, last name (optional), a
  password shown as typed (the admin passes it on) and "Grant admin role". Save is off until the email, the
  first name and a password of at least 6 characters are in; `createAdminUser` (`POST /v1/admin/users`) sends
  them. A refusal shows in the dialog as the backend worded it, a taken email's 409 included (its
  `existing_user_uuid` isn't used yet), and the form keeps what was typed. After a success the list is read
  again and a one-time banner names the new email and says to share the password, until it is dismissed or
  another dialog is opened. The new user is on no project until given a role on the project roles page. A non-admin who opens the
  URL is told it is for admins; the backend returns 403 to them anyway.
- **Passwords.** A user changes their own; an admin resets anyone's. Neither signs anyone out: tokens already
  issued stay valid.
  - **Change password** (`ChangePasswordModal`, "Change password" in the user menu, after the signature item and
    before the admin entries): current, new and confirm, each masked with a show / hide button. Save is off until
    all three are in, the new one has at least 6 characters, matches its confirmation and differs from the current
    one. The modal runs `changeOwnPassword` (`POST /v1/users/me/password`) itself. A refusal, a wrong current
    password included (a 400, not a 401, so it doesn't sign the user out), shows inline as the backend worded it
    and the form keeps what was typed. After a success `UserMenu` shows "Password updated. Use it on next
    sign-in." once, in a green banner fixed under the header, until it is dismissed or the dialog is opened again.
  - **Reset password** (`AdminResetPasswordModal`, a button after "Edit" on each `/admin/users` row): one new
    password, shown as typed since the admin passes it on; Save is off under 6 characters. The modal runs
    `resetUserPassword` (`POST /v1/admin/users/{user_id}/password`) itself, and the list isn't read again. A
    refusal shows inline. After a success the page's one-time banner reads "Password reset for <email>. Share
    with them securely — it won't be shown again."
  - **Demo users** get neither: no menu item, and no button on their row. That is only hidden here; the backend
    would still take an admin's reset of a demo user.
- **All Projects (admin).** `/admin/projects` (`AdminProjectsPage`), "All Projects (Admin)" in the user menu, which
  only an admin sees. One `GET /v1/admin/projects` (`listAdminProjects` in `services/projects.js`), shown in the
  backend's order (by project ID): project ID, name, description, borough, registration code and status, a dash
  for whatever a project lacks. Nothing on a row is editable or opens anything yet.
  "Create project" (right of the heading) opens `CreateProjectModal`: project ID, project name, description,
  borough (free text: there is no borough list) and registration code (optional). Save is off until the first
  four are non-blank; `createAdminProject` (`POST /v1/admin/projects`) sends them trimmed, a blank registration
  code as `null`. A refusal shows in the dialog as the backend worded it, a taken project ID's 409 included (its
  `existing_project_id` isn't used yet) and a project ID with anything but letters, digits, hyphens and
  underscores (400), and the form keeps what was typed. After a success the list is read again and a one-time
  banner reads "Created project <project_id>.", until it is dismissed or the dialog is opened again. The new
  project has no status and is on nobody's project list until someone is given a role on it
  (`/admin/projects/<project_id>/roles`). A non-admin who opens the URL is told it is for admins; the backend
  returns 403 to them anyway.
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
  - `GET /v1/projects/{id}/quantities?from=&to=` (the Progress page; for a user on the project, or an admin)
  - `GET /v1/admin/projects` · `POST /v1/admin/projects` (admin only: every project, and creating one)
  - `GET /v1/admin/users` · `POST /v1/admin/users` · `PATCH /v1/admin/users/{user_id}` ·
    `POST /v1/admin/users/{user_id}/password` (admin only: every user, creating one, changing a user's first and
    last name, and resetting a user's password)
  - `POST /v1/users/me/password` (the signed-in user changes their own password)
  - `GET /v1/users/` (the IDR page's banner resolves reporter_uuid → name; the roles page lists who can be given a role; not available to demo users)
  - `POST /v1/idrs/` · `GET /v1/idrs/?project_id=&reporter_uuid=&status=` (plus `include_deleted=` and
    `include_all_drafts=`, admin only; and the archive's `idr_number=`, `work_date=`, `from=`, `to=` and
    repeatable `discipline=`; each row carries `disciplines`) · `GET /v1/idrs/{id}`
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
