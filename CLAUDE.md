# CLAUDE.md

Standing instructions for anyone (human or Claude Code) working in this repo.

## What this repo is

The frontend for ICID (Integrated Construction Information Database), a construction inspection reporting SaaS.
React 18 + Vite + Tailwind + React Router v6, deployed on Vercel. All data comes from the ICID backend API
(`VITE_API_URL`, default `https://icid-backend.vercel.app`) — the frontend never touches the database directly.

Commands: `npm run dev` (port 3000) · `npm test` · `npm run test:coverage` · `npm run build`

## Folder structure

- `src/pages/` — top-level routed pages (login, project selection, project dashboard, drafts list, report archive, progress, a project's properties, one property and its PIR workspace, a project's task orders and one task order, IDR, review queue, project roles, and the admin's all-IDRs, all-users and all-projects lists and a project's pay items, and the Smart PIR import). One page per file.
- `src/pages/reports/` — inspection report form pages (General, SWCB, AC, DSP, ConcMix, ConcCyl).
- `src/contexts/` — React context providers: `AuthContext.jsx` (the signed-in user; see Sign-in below), `ProjectRolesContext.jsx` (the roles they hold on each project; see Review below), `TaskCountContext.jsx` (how many IDRs are waiting on them), `RedlineContext.jsx` (a field's reviewer edits and the edit calls, for `RedlinedField`; and which IDRs have edit mode on) and `LeaveGuardContext.jsx` (lets a page with unsaved edits stand between the app header and a navigation away; see Navigation below).
- `src/services/` — all backend access. One file per resource (`auth.js`, `signatures.js`, `projects.js`, `idrs.js`, `reviews.js`, `fieldEdits.js`, `idrReports.js`, `users.js`, `attachments.js`, `contractItems.js`, `exports.js`, `quantities.js`, `payItems.js`, `properties.js`, `taskOrders.js`, `pirs.js`, `pirPages.js`, `flags.js`, `nonAssessableAreas.js`, `features.js`, `segments.js`, `idrFlags.js`, `progress.js`, `constructionReport.js`, `assessmentSummary.js`, `pirTitleBlock.js`, `pedRamps.js`, `pedRampInspections.js`, `pedRampTifs.js`, `pedRampPhotos.js`, `pedRampListing.js`) on the shared `apiFetch` helper (and `apiFetchFile`, for a file the backend returns itself); `api.js` re-exports them all.
  Exception: `session.js` holds the session token helpers (`getToken` / `setToken` / `clearToken`, stored in
  `localStorage` under `icid_token`), not backend calls; components get the current user from `useAuth()`.
- `src/lib/` — third-party client setup and small utilities. Holds `reportData.js` (shared form-state helpers), `personName.js` (the name to show for a user), `useReportForm.js` (the hook every report page uses for load/save/state), `reviewRoles.js` (which review queues and actions a user gets), `fieldEdits.js` (reading an IDR's edit history: one field's chain, pay-item paths, "revised after return"), `useReviewEditing.js` (whether the user may edit, edit mode, the edit calls), `listOrigin.js` (which list opened an IDR, carried in router state), `returnTo.js` (`readReturnTo` and `withReturnTo`: the IDR report page a site page or its PIR workspace was opened from, in `?returnTo=`), `shortDate.js` ("Sep 14" for the admin tables), `formErrors.js` (a failed admin form save split into per-field and general messages), `taskOrders.js` (a task order's delete / un-delete wording and "24 properties"), `properties.js` (a property's, and `siteName`: what a site is called in dialogs and toasts), `pirs.js` (a PIR's, `pirStatus` and `pirStatusFromApi`), `flags.js` (a new flag's defaults, `newFlagValues`, and the thickness colours), `flagGeometry.js` (a flag's outline on its page, in page pixels), `flagGroups.js` (how the sketch dresses a page's flags: each one's fill, the "4\" Conc." / "7\" Conc." runs and the areas' A-labels), `pageGeometry.js` (a PIR page's size on screen at its rotation, and `toNativeCoords`: a pointer's place in the page's native pixels; see PIR pages), `flagArea.js` (a flag's area from its shape, as the backend computes it, and "42.50 SF"), `useUserNames.js` (names for the user ids a page shows: the admin's user list for an admin, the members' list for anyone else, none for a demo user), `payItemFormat.js` (how the pay-item pages, the admin's and Progress, print a quantity, dollars, a unit price and a percent, and `formatFlagQuantity`: a flag quantity to two decimals), `idrFlags.js` (an IDR's flags as the pages word them: a flag's site, amount and sketch link, who may exclude or include one, the claim and release sentences; see IDR flags) and `signatureImage.js` (crops a drawn signature to its ink and turns it into the PNG that is uploaded). Also contains the legacy `supabase.js` — see Known technical debt.
- `src/data/` — static/mock data (report type definitions, `disciplines.js`: the discipline names the archive filters by, and `propertyTypes.js`: the three property types and their labels, `propertyKinds.js`: the two kinds of site, the boroughs, quadrants and ramp types, with `facingStreetName` and `withoutLeadingZeros`, and `flagEnums.js`: a flag's shapes, marks, non-assessable reasons and thicknesses with their labels, and `dspForm.js`: the Daily Site Patrol's checklist items and questions, its blank `report_data` and its save check).
- `src/test/` — global Vitest + React Testing Library setup (`setup.js`) and shared test helpers: `mockFetch.js`, `users.js` (`TEST_USER`, `DEMO_USER` and `sessionFor`, shaped as the backend returns them), `contractItems.js` (a `getContractItems` response fixture for the pay-item picker) `idrFlags.js` (`idrFlag` and `idrFlagsData`: a `getIdrFlags` response) and `progress.js` (progress rollups shaped on SE384's walkthrough: `PROJECT_PROGRESS`, `TASK_ORDER_PROGRESS`, `EMPTY_PROGRESS`, `progressItem`).
- `src/components/` — shared UI components (`AppLayout` and its `AppHeader` and `UserMenu`, `ProtectedRoute`, `GoToProjectButton`, modals, attachments, IDR report rows, save / submit controls, and the review pieces: `ReviewToolbar`, `AcceptStage1Modal`, `ReturnCommentModal`, `ReturnNotice`, `StatusBadge`, `IDRNumberBadge`, `IdrTable`, the archive's `ArchiveFilters`, the Progress page's `BudgetCodeCard`, `Bar` and `ProjectFlagProgress`, the flag-progress pieces both Progress views share (`FlagProgressTable`, `UnmappedFlagsNote`) and the task order page's `TaskOrderProgress`, `DownloadFileButton` (the Construction Reports' and the Assessment Summary's downloads), As-Builts & Assessments' `SidewalkAssessmentTab`, the PIR workspace's `TitleBlockEditor`, and the admin pay-items page's `AssessmentRatesCard`, Site Info's `SiteSection`, `PedRampsSection` and `PedrampSiteModal`, `FoldingPanel` (a titled panel that folds), the task order list's `SiteKindBadges`, the ped ramp inspection's `PedRampPhotosSection` and As-Builts & Assessments' `PedrampInspectionReportsTab`, the property page's `RampAttributesSection`, the admin import's `SmartPirImportForm` and `BackToReportButton` (the site page's and PIR workspace's "Back to report"; see returnTo)); `src/components/sketch/` holds the PIR sketch workspace (`SketchWorkspace`, `SketchCanvas`, `RotatedPage`, `ShapeToolbar`, `FlagPanel`, `CalibrateControl`, `FlagsFallbackList`, and for the Smart PIR drawings `SketchPatterns`, `FeatureGlyph`, `SketchLegend`; see PIR pages and Smart PIR drawings); `src/components/reports/` holds the report-form sections (including `PayItemsSection` and its catalog `PayItemPicker`), the report page shell and the addendums section.
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
- **Construction Reports** (R1h). A property's as-built sheet for an approved IDR (DOT form 5/95), a PDF the backend
  draws; an approved IDR's reports, one PDF per property it claimed flags on, as a ZIP.
  - **Service:** `services/constructionReport.js`: `downloadConstructionReport(propertyId, idrId?)` and
    `downloadConstructionReportZip(idrId)`. Both fetch the file with `apiFetchFile` (`services/apiClient.js`: the
    request, the 401 and the errors as `apiFetch`'s; the name from `Content-Disposition`, which the backend's CORS
    exposes) and save it with `saveFile` (`services/exports.js`: an object URL through `downloadFile`). `SKETCH_TOO_LARGE_MESSAGE` is the backend's 422,
    word for word, in one place.
  - **`DownloadFileButton`** (`label`, `download`, `enabled`, `disabledTitle`), shared with the Assessment Summary: a spinner while the file
    is made; a failure under it. A 422 (a sketch too large for one sheet) and a 404 show the backend's words and can't
    be retried; anything else reads "Download failed: …" with Retry. Off, it carries `disabledTitle` as its tooltip.
  - **Property page:** "Download Construction Report" leads the Site card's buttons, for everyone (demo users too:
    it only reads). It is on once one of the live PIR's flags has `claimed_by_idr_id` (only an approval claims), read
    with `listFlags`; off with `NOT_COVERED` (PropertyPage's) without one, or without a live PIR; on when the flags can't be read, so
    the backend's 404 says why. It downloads the most recently approved IDR's report.
  - **IDR page:** an approved IDR gets "Download Construction Reports" beside Export, on when its frozen flags
    (`getIdrFlags`) count one it claimed, off with `CLAIMED_NO_FLAGS` otherwise. No other status has it.
- **Ped ramp inspection** (pedramp 2a). NYC DOT's Pedestrian Ramp Inspection Form as data, and the backend's own
  inspection report of it (DOT's fillable PDF, photos and the email export are 2b, not built).
  - **Service:** `services/pedRamps.js`: `listCorners(projectId, {includeDeleted})`, `getCorner`, `createCorner`,
    `updateCorner`, `deleteCorner` (admin), `createPedrampSite(projectId, data)` (Slice R: a corner and a ramp at it in
    one call; returns `{corner_id, property_id, corner_reused}`), `getRampAttributes(propertyId)` (null for the
    backend's 404 `Ramp attributes not entered`), `saveRampAttributes` (a PUT of the whole set), `saveRampLabel(propertyId,
    rampType, label)` (reads the attributes, then PUTs them whole with the new Ramp ID, only its ramp type's keys) and
    `downloadInspectionReport(cornerId)` (the PDF, through `apiFetchFile` and `saveFile`). The form's choices, labels
    and each ramp type's fields are `data/pedRampForm.js` (`CORNER_SECTIONS`, `RAMP_FIELDS`, `rampKeys`, and the
    Pedramp dialog's `SITE_CORNER_SECTIONS`), mirroring the backend's. `createCorner` is no longer called by a page.
  - **Site Info (Slice R): the corner is not an entity of its own in the UI.** An inspection is a corner with its
    ramps, so "Pedestrian Ramps" (`PedRampsSection`) is the one section: a row per ped ramp site, stacked under its
    corner. See "Two sections" under Properties.
  - **Property page:** Edit on a ped ramp at a corner opens the Pedramp dialog in mode `edit-ramp` (see "The Pedramp
    dialog" under Properties). A ped ramp's Site card adds "Inspection corner" (its streets and direction, or a dash), and
    under the card `RampAttributesSection`: its type's answers left and measurements right (slopes %, lengths in), then
    comments; the backend's ADA warnings listed above ("N ADA warning(s) (saved anyway)") and their fields marked
    `(ADA)`; they never stop a save. Whoever can change the site saves the whole set (off until something changed or
    while a measurement isn't a number); everyone else reads it. A ped ramp at a corner also gets "As-Built Inspection
    Form" beside Edit. `RampAttributesSection` scopes its element ids with `useId`, since the inspection form shows one
    per ramp.
  - **DOT's choice lists** (backend migration 048, one-way): `ENTITIES` is DOT's 13, `CURB_MATERIALS` has no
    cobblestone, `DWS_COLORS` red / white / dark on light / light on dark / other, `DWS_MATERIALS` preformed plastic
    (embedded) / (surface applied), cast in place (surface applied), cast iron, stone, concrete tile.
  - **The inspection workflow** (Pedramp Phase 3, S1). `services/pedRampInspections.js`: `getCornerInspection(cornerId)`
    (null when none was started), `startInspection`, `updateInspection(id, requirementsMet)`, `submitInspection`,
    `returnInspection(id, comment)`, `approveInspection`. Two stages: an inspector submits (signing), an RE approves
    (signing) or returns it to draft with a comment; an admin stands in for either; roles from `useProjectRoles`.
    - **`PedRampInspectionPage`** at `/project/:projectId/ped-ramp-corners/:cornerId/inspection`, from "As-Built
      Inspection Form" on a corner's heading row, on each of its ramp rows (`#ramp-<property id>`, scrolled to that
      ramp's card; `inspectionPath` in `PedRampsSection`) and on a ped ramp's site page. One scrolling page: the status
      (Not started / Draft / Returned / Submitted / Approved, with who submitted and approved it when), the moves the
      user's roles allow (Start inspection: an inspector or RE; Submit: an inspector, confirmed; Return: an RE, through
      `ReturnCommentModal`, a comment required; Approve: an RE, confirmed), a returned draft's comment, sections 1-4
      (the corner, read-only, with "Edit corner": the Pedramp dialog in mode `edit-corner`, A-C only, saving through
      `updateCorner`), "Are all ADA requirements met?" (Yes / No, saved at once; No notes that a failing ramp needs a
      TIF), and section 5 as a card per ramp (`RampAttributesSection`, each saving its own). There is no page-wide
      Save Draft: each part saves itself.
    - **The lock**, as the backend's: a draft (or no inspection) is anyone's on the project but a demo user's;
      submitted, only an RE edits ("Inspection is submitted — only the RE can edit" reads above the form, and the
      editors are off); approved, nobody ("Inspection is approved — no further edits"). Every refusal reads as the
      backend words it, in its dialog ("Signature required before signing an inspection", "Approve or delete this
      inspection's draft TIFs first").
    - **Admin unlock** (Slice T1): an admin sees "Admin: Unlock inspection" on an approved inspection
      (`unlockInspection`); its confirm lists what reopens (the RE's approval and the submit, the requirements answer,
      every approved TIF, the link to the filed DOT forms) and what stays (the corner, measurements, photos, the
      inspector's signature; the filed forms kept in Storage). It returns to draft; "Last unlocked by ... on ..." then
      reads in the status line.
    - **Downloads:** "Preview (ICID)" (the ICID inspection report, `downloadInspectionReport`, for everyone) and, once
      approved, "Download DOT form" (`downloadInspectionDotForms`: DOT's fillable forms as filed at approval, through a
      signed URL; a ZIP when the corner needs several forms or has TIFs), with `DOT_FORM_NOTE` under it, which ends with
      `ACROBAT_SAVE_NOTE` (the forms keep NeedAppearances so they stay fillable: Acrobat may ask to save on close; No is
      right). The TIF page shows the same note.
  - **TIFs** (Pedramp Phase 3, S3). `services/pedRampTifs.js`: `listInspectionTifs`, `draftTif(inspectionId,
    propertyId)`, `getTif`, `updateTif` (only what changed; null clears), `approveTif(id, {signer_name,
    signer_ny_license_no})`, `deleteTif` (admin) and `downloadTifForm` (DOT's TIF filled as it stands, through a signed
    URL); `getInspectionReport(cornerId)` in `pedRamps.js` reads the ramps' ADA warnings.
    - On the inspection form, once "Are all ADA requirements met?" is No, each ramp card shows its TIF (a link, with its
      status) or, for a ramp whose attributes raise ADA warnings, "Draft TIF" (an inspector or an RE while the lock
      allows; it drafts one, prefilled by the backend, and opens it). Approving waits for every TIF to be approved.
    - **`PedRampTifPage`** at `/project/:projectId/ped-ramp-tifs/:tifId`: DOT's sections 1-7 (`data/tifForm.js`,
      `TIF_SECTIONS`) on one page with Save (only what changed); "10. Statement and signature" for an RE (or admin):
      their name (their own to start) and New York licence number, both required, then "Sign & Approve" (off while
      there are unsaved changes), under `SIGNATURE_NOTE` (an ICID signature image, not a cryptographic signature);
      "Download TIF form" for everyone; Delete for an admin (confirmed; back to the ramp's card). The lock: an approved
      TIF reads "TIF is approved — no further edits"; otherwise the inspection's lock (submitted: the RE only;
      approved: nobody).
  - **Photos** (Pedramp Phase 3, S4). `services/pedRampPhotos.js`: `listPhotos`, `uploadPhoto` (sign, PUT, complete),
    `updatePhoto`, `deletePhoto`, `validatePhotoFile`, `nextPhotoNumber`, `photoCount`, and `PHOTO_ACCEPT`,
    `PHOTO_MAX_BYTES`, `MAX_PHOTOS_PER_FORM`. **`PedRampPhotosSection`** (`parent {type: 'inspection' | 'tif', id}`,
    `propertyId`, `canEdit`, `kinds`, `onPhotosChange`): thumbnails with number and caption; upload (JPEG / PNG / HEIC,
    at most 10 MB, numbered with the lowest free number, unique on the form, checked before sending); inline edit;
    confirmed delete; "N of 20 photos on this form" (the count and the uniqueness cover the whole form); a single "Site
    design / layout" slot for a TIF when `kinds` has `'layout'`. It sits on each ramp card of the inspection form
    (that ramp's photos) and on the TIF page (section 8, and 9's layout), under each page's lock. Submitting a form with
    no photos shows `NO_PHOTOS_WARNING` in the confirm dialog: a warning only for the pilot.
  - **Pedramp Inspection Reports** (Pedramp Phase 3, S5): As-Builts & Assessments' Pedramp tab
    (`PedrampInspectionReportsTab`, `services/pedRampListing.js`: `listPedRampInspections`,
    `bulkDownloadPedRampInspections`, `LISTING_PAGE_SIZE`): every corner with an inspection, 30 a page: Corner (a link
    to its inspection form), Ramps, Status, Inspector, RE, Approved, TIFs, and Download (`downloadInspectionDotForms`)
    once approved. Filters (approved date range, status, inspector, RE, has TIF) and a search (a street or a Ramp ID,
    after 300 ms) live in the URL beside `?tab=`, and any change goes back to page 1. "Download all (zip)" asks the
    backend for one ZIP under the same filters (a folder per corner; at most 100) and opens its signed URL.
- **Title block** (R1h.2, R1h.3). The fields the Construction Report prints: page 1's Contract No., Date Notice Issued,
  Date Excavated and Date Constructed, the PIR's North Bearing, and (R1h.3) the streets and widths round its sketch:
  `cross_street_left`, `cross_street_right`, `frontage_street` (the bottom; the top is always the property line, PL),
  `tax_map_width_ft` and `cc_curb_to_curb_ft`.
  - **On the PIR workspace,** under the heading, one line: "Contract: HWS0023 · Constructed: 2026-10-05 · ↑ NE" (a dash
    for what isn't set), read with the pages (`getPageTitleBlock` on page 1, and the PIR's `north_bearing`), with "Edit
    title block" beside it, and a second line, "Streets: 139 AVENUE / 227 STREET / 138 AVENUE" (left, frontage,
    right; `streetsLine`, each cut to 20 characters, a dash when not set). No line without a page 1; a failed read says so and leaves the button off, so nothing is
    saved over values never loaded.
  - **`TitleBlockEditor`** (`pirId`, `titleBlock`, `canEdit`, `onSaved`, `onGone`, `onClose`), a dialog "Title block —
    Page 1": a text field, three date inputs, a compass select (blank is "—"), and a "Streets" group (`STREET_FIELDS`,
    at most 60 characters each; `WIDTH_FIELDS`, text inputs sent as typed, so the backend's 400 names a bad width). Save is off until something changes
    and sends only what changed (`updatePirTitleBlock`, `PATCH /v1/pirs/{id}/title-block`; blank as null, which clears
    it). A refusal shows under Save; a 404 closes it with "PIR not found" on the page. A soft warning when Date
    Excavated is after Date Constructed; nothing stops the save. For anyone who can't write (a demo user, or anyone
    but an admin on a deleted site) the fields are off and there is no Save. After a save the line and the PIR show
    the saved block, with a "Title block saved" toast.
- **As-Builts & Assessments** (Slice C). `/project/:projectId/assessments` (`AssessmentsPage`), reached from the
  "As-Builts & Assessments" link beside the Progress and Assessments page's title, for everyone on the project. A tab
  bar of report types (`REPORT_TABS`; a new report is one more entry), the tab in `?tab=` (none, or an unknown one, is
  the first): "Sidewalk Assessment Summary" (`SidewalkAssessmentTab`) and "Pedramp Inspection Reports" (`PedrampInspectionReportsTab`; see "Pedramp Inspection Reports" under Ped ramp inspection).
  Changing tab drops the other tab's parameters. Back: "Back to Progress and Assessments".
  - **Sidewalk Assessment Summary:** `getAssessmentSites(projectId, { from, to })` (`GET .../assessment-summary`), a
    row per constructed site, its figures summed over the date-constructed period (Constructed from / to, `?from=&to=`,
    YYYY-MM-DD; none to start, every date; From after To says so and asks nothing). A search box (`?q=`) narrows the
    rows in the page by address, block, lot, block and lot together (`123 45`, `123/45`, `123-45`) or violation no.
    (`matchesSearch`). Columns as the workbook's: Property Address (a link to the site's page, "Block 123 Lot 45 ·
    V-77" under it), CB, the 4" and 7" square feet (two decimals, a dash for none) and amounts (a dash without a rate),
    Grand Total, Remarks, and Construction Report (a "PDF" `DownloadFileButton`, the most recently approved IDR's). A
    totals row sums the rows shown. "N sites" over the table ("of M" while searching); empty: "No constructed sites
    yet.", "No sites were constructed in this period." or "No constructed sites match …".
  - **Downloads** under the table: "Download tailored report" (`downloadTailoredAssessmentSummary`: the period and,
    while searching, the shown sites' ids; one tab named for the period; off when no row is shown) and "Download
    accumulative report" (`downloadAssessmentSummary(projectId)`: the whole project's workbook, a tab per month named
    "Nov 2026", whatever the filters). A failure shows under its button.
- **Progress from PIR flags** (R1g). How much of the sidewalk work the PIR flags describe is approved (claimed by an
  approved IDR), in flight (attributed to an open IDR) or unclaimed, per pay item a flag can fill. Two places: the top
  of the Progress page (`ProjectFlagProgress`) and the task order page (`TaskOrderProgress`).
  - **Service:** `services/progress.js`: `getProjectProgress(projectId, { taskOrderId, propertyId, includeEmpty })`
    and `getTaskOrderProgress(taskOrderId, { includeEmpty })`. The backend does every sum and lists only the pay items
    a flag in scope is on (`includeEmpty` would list the whole flag-measurable catalog: SE384 has 265; not used).
  - **`FlagProgressTable`** (`payItems`, `label`): Pay Item ("4.13 AAS (SF)", its budget code under it), Description,
    Approved, In flight, Unclaimed, Live total and %. A state prints its quantity to two decimals (`formatFlagQuantity`;
    the backend sends it unrounded) and its flag count ("383.44 (10 flags)"; "(3 segments)" on a pay item in LF, which
    curb segments fill: `flagCount(count, unit)`); an empty state and a null percent print
    "—". Rows are keyed on `pay_item_id`: one item number can sit under two budget codes.
  - **`UnmappedFlagsNote`** (`projectId`, `entries`): "3 unmapped flags on 350 Main St" per site with live flags that
    add nothing (no pay item, or a unit a flag can't measure), each linking to the site's PIR page
    (`/project/<id>/properties/<property id>/pir`), unfiltered (a flag filter on the sketch is backlog). Nothing when
    there are none.
  - **On the Progress page**, "Sidewalk progress (PIR flags)" comes first, above "Budget against actual". Its Task
    order and Site selects are in the URL (`?task_order=&property=`, `replace`), beside the budget view's dates; each
    keeps the other's parameters. With no task order the sites are the project's live ones (`listProperties`); with
    one, its bundle (`getTaskOrder`); picking another task order clears the site. A headline reads "100.0% approved
    overall · $4,753.38 of $4,753.38 live" (the percent is "—" while nothing is live), then the table ("No flags with
    pay items here yet" when empty) and the unmapped lines. It loads and fails on its own, with Retry, and its loading
    line is text, not a spinner (the page's spinner is the budget view's). A filter that fails to load its choices
    says so under the selects and the rollup still shows. The date range doesn't apply to it.
  - **On the task order page**, a Progress section after Bundled sites, folded open to start: "Overall 100.0%
    approved · 2 of 5 sites started" (`sites_started` of `site_count`: bundled sites with an approved flag), the
    table, the unmapped lines, then "By site": a row per bundled site, folded shut, reading "100.0% approved · 10
    flags" (or "No flags yet"; "· N unmapped" when it has any), that opens to its own table. Under the rows, a small note (`ROUNDING_NOTE`): each figure is rounded for display
    from the backend's full-precision quantity, so rounded site rows can miss the rounded total by a little (TO-002:
    2.03 + 0.97 CY against 3.01, from 3.006); the totals come from the unrounded amounts. It is read again whenever
    the page's task order changes (an edit, bundling, unbundling).
  - Everyone who can read the project sees it, demo users included; there is nothing to change.
- **Progress.** `/project/:projectId/progress` (`ProgressPage`, titled "Progress and Assessments — <id>"), the
  "Progress and Assessments" tile on the project dashboard, with the "As-Builts & Assessments" link by its title:
  the flags' progress above (see "Progress from PIR flags"), then budget against actual, by contract value. What the pay-item quantities of the project's approved IDRs are worth
  at their contract items' unit prices, beside what those contract items were bid at.
  - **One call:** `listQuantities({ projectId, from, to, cumulative })` in `services/quantities.js`, which is
    `GET /v1/projects/{id}/quantities`. The page reads the response's roll-ups: `pay_items`,
    `totals_by_budget_code`, `project_total` and `unbudgeted_total`. It no longer reads `rows` (nor
    `totals_by_unit`, `truncated`): the roll-ups are never cut short, so there is no 10,000-row banner. The
    route's other filters (pay item, budget code, discipline, inspector) aren't used yet. It answers 403 to a
    user who isn't on the project; the page shows that like any other failure, with Retry.
  - **Where the budget comes from.** The backend does all the sums. The budget is always every contract item of
    the project (the catalog an admin keeps on the pay items page), whatever the dates; only the actuals follow
    the range. A quantity is matched to a contract item by its ref and budget code. One that matches none is
    **unbudgeted** (a change order, an item added by description alone): it has a quantity but no value, and is
    in no total and no percent.
  - **The range is in the URL** (`?from=&to=`, the archive's convention), written with `replace` so picking dates
    doesn't pile up history. **The page opens cumulative** (Slice D): a URL with neither dates nor `cumulative`
    is cumulative, and one with dates but no `cumulative` is a range (as links were before). Unticked with no dates
    (`?cumulative=false`) means the last 30 days (`DEFAULT_RANGE_DAYS`), by the viewer's own calendar (`date-fns`,
    never `toISOString()`, which is UTC's day). A URL naming either bound is taken as it stands: a cleared picker is
    an open bound, and clearing both is the 30 days again (`?cumulative=false`).
  - **From after To** shows a red hint under the pickers, hides the results and asks the backend nothing.
  - **Show cumulative** (a checkbox beside the pickers, ticked to start; `?cumulative=true|false`) asks for every approved quantity,
    whatever its date: the request is `{ projectId, cumulative: true }` with no dates. The pickers are disabled
    and a line says the range is off; the dates stay in the URL for when the box is unticked. A backwards range
    doesn't matter while it is ticked.
  - **Three sections, top to bottom**, all from the one response:
    - **Project total** (one wide card): the percent in large type, "$125,430 of $18,793,394 billed" (whole
      dollars), a bar, and a small line "actuals: Sep 13 – Oct 13 · budget: full project" ("from Sep 13" /
      "through Oct 13" for an open bound, "full project" when cumulative; a date of another year carries its
      year). When any pay item is unbudgeted, a line counts them. A project with no contract items (no budget
      codes in the response) reads "No budget set for this project" with no percent and no bar; nothing has a
      dollar value then, so only that count is shown.
    - **Budget codes** (`BudgetCodeCard`, a grid): one card per budget code of the catalog, booked against or
      not, in the backend's order. The code in mono, its percent, a bar, "$45,230 of $1,205,214" and "2 items
      with activity" (or "No activity"; "· 1 unbudgeted" when quantities under the code match no contract
      item). The response only lists pay items that have quantities, so the card can't say how many the code
      has in all. The code's name is a button that folds those items open under it; closed to start.
    - **Pay items** (the table): one row per entry of `pay_items`, in the backend's order (budget code, then
      ref, as text): Pay Item, Description, Budget Code, Total Qty to date ("Total Qty in range" when not
      cumulative), Unit, Total contract Qty (`budgeted_quantity`, the bid quantity), Cost to date (`actual_value`,
      dollars and cents) and % Progress: quantity over contract quantity, to 1 decimal place (worked out on the
      page, a dash for a contract quantity of 0), in the warn colour past 100. No bar. An unbudgeted row stays in
      the table with dashes for its contract quantity and cost and a muted "— unbudgeted" in % Progress. With nothing approved in the range the table gives way to "No
      approved quantities in this range" ("...yet" when cumulative); the two sections above still show, at 0%.
  - **Over budget** (a percent past 100) takes the warn colour on the percent and the bar, at all three levels:
    Tailwind's `warn` (`text-warn`, `bg-warn`), which is the `--warn` token in `src/index.css`, kept apart from
    the construction accent. The app has no dark theme, so the token has one value.
  - **`Bar`** (`src/components/Bar.jsx`) is the progress bar, CSS only: `percent` (null is an empty track; past
    100 the track is full and a small arrow follows it), `tone` (`default` or `warn`) and `label`.
  - **Numbers** print through `lib/payItemFormat.js`: `formatDollars(value, { cents })`, `formatPercent` (one
    decimal; a dash for null, which is what a contract item bid at nothing has) and `formatPayItemQuantity`.
  - **Items added by description alone** have no ref or budget code, and the backend's roll-up groups those by
    unit only, so unrelated ones that share a unit arrive as one row. That is the backend's grouping.
  - No export and no breakdown by inspector or day yet.
- **Daily Site Patrol (DSP).** `/project/:projectId/idr/:idrId/dsp/:reportId` (`DSPReportPage`), the IDR's one DSP,
  a top-level report again (V4, reversing U1's addendum): added from the IDR page's Add report control (`AddReportControl`)
  like a General, SWCB or AC. Once the IDR has a DSP, addendum or not (`findDsp`), the option reads `Daily Site Patrol
  (already added)`, disabled and titled "DSP already added to this IDR." (`DSP_TAKEN_TOOLTIP`); the backend's 409 (`This
  IDR already has a Daily Site Patrol`) shows as `Couldn't add report: ...` and the page refetches. A DSP filed as an
  addendum under U1 still lists and opens in its parent's Addendums card; one made as a main
  report before U1 still opens and lists as before. Like every report page it has Attachments (its sketches and photos,
  printed after DSP Fr); its Addendums card lists but has no Add addendum (W1, `addendumTypesFor`: no Conc Mix or Conc
  Cyl under a patrol). Its `report_data` is the one the backend checks (`DspReport`; 400 otherwise):
  `{timeOfPatrol, mosChecklist, mptChecklist, fieldOrderIssued, fieldOrderNumber}`, each checklist a row per item of
  `dspForm.js` in its order (`{item, answer: 'yes' | 'no' | 'na' | null, details}`); the page always saves the whole
  form. The date, day of week, I.R. No. and sheet show read-only (the export works them out). A field order issued
  without a number blocks the save inline, as the backend would refuse it; a No without details only warns. Submit
  asks `DSP report has no answers; submit anyway?` when a DSP has nothing answered (`dspHasNoAnswers`), never blocks. No
  redlines yet: in review its inputs stay disabled.
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
  sees. One `GET /v1/idrs/` with `include_all_drafts=true` and no project. `IdrTable` with its optional
  `sort` / `onSort` (work date by default, submit date, status) and `renderActions`. Rows don't open the IDR page.
  A non-admin who opens the URL is told it is for admins; the backend returns 403 / 400 to them anyway.
  - **The two checkboxes** (both off to start; the page has no other filters). "Include deleted" asks the backend
    again, with `include_deleted=true` while it is ticked; the table stays on screen meanwhile, and a failed
    re-list is the load error with Retry. "Show all drafts" only filters what was fetched (other people's
    drafts are always asked for).
  - **A deleted IDR** (`status === 'deleted'`) reads Deleted in the status column, and `IdrTable` crosses out its
    number (`IDRNumberBadge`'s `struck`) and its work date. It always shows once it was fetched, a deleted draft
    of someone else's included.
  - **Actions by state.** A live IDR has "Soft-delete" and, for `ADMIN_UNLOCKABLE_STATUSES` in
    `lib/reviewRoles.js` (`approved`, `stage2_review`: what the backend accepts), "Unlock". A deleted IDR has
    "Un-delete" and "Delete forever" instead. Each is confirmed first, a refusal shows in its dialog, and after
    a success the page reads the list again rather than patching the row, then refreshes the task count.
  - **Releasing flags (R1f).** Unlock and Soft-delete on an approved IDR release the flags it claimed. Their dialog
    reads how many first (`getIdrFlags`, `counts.attributed`): "Counting the flags it claimed...", then "This will
    release 18 flags back to the pool." ("It has claimed no flags, so none are released."; a failed count says so
    and the action still goes). The toast after repeats the backend's `flags_released`: "IDR 004 unlocked; 18 flags
    released." / "IDR 004 deleted; ...". An IDR at any other status has claimed nothing and isn't asked about. An
    un-delete back to approved adds "3 flags claimed back." to its toast.
  - **Unlock** on an IDR in RE Review that no RE has accepted (no `re_reviewer_uuid`) sends nothing and shows
    the toast "Already unlocked — IDR is in RE Review"; once an RE has accepted it, Unlock still asks and goes
    through, since that takes the IDR off them.
  - **Unlocking an approved IDR** (Slice T2) is how one is corrected: its dialog lists what reopens (the RE's approval
    and signature, picked up again from the queue by any RE on the project; its pay-item quantities; the flags and
    curb segments it claimed) and what stays (its number, reports, the inspector's signature, the OE's acceptance). An
    IDR an admin has unlocked shows "Last unlocked <date> by <name>" under its actions (`last_unlocked_at`,
    `last_unlocked_by_name`).
  - **Un-delete** (`undeleteIdr`): "Un-delete IDR <number>?" in `ConfirmDialog`. The backend gives the IDR back
    the status it had when it was deleted (a draft when that isn't on record); the toast reads "IDR <number>
    restored to <status>." from the IDR the call returns. It answers 409 when another IDR has since taken the
    day or the number, which shows in the dialog.
  - **Delete forever** (`permanentDeleteIdr`): `DeleteForeverModal` (shared with the users page), a red warning and a box; the button is
    off until the box holds the IDR's number exactly as written (no trimming, capitals count). Then the row is
    gone and the toast reads "IDR <number> permanently deleted." The backend only takes an IDR that was
    soft-deleted first (404 otherwise), which is why only a deleted row has the button.
  - **An IDR with no number** (deleted as a draft or before IDR Check) is named "IDR of <date> on <project>" in
    both dialogs and toasts (`idrName`), and the phrase to type is its work date, `YYYY-MM-DD`
    (`deleteForeverPhrase`).
- **All Users (admin).** `/admin/users` (`AdminUsersPage`), "All Users (Admin)" in the user menu, which only an
  admin sees. One `GET /v1/admin/users` (`listAdminUsers` in `services/users.js`), shown in the backend's order:
  email, first name, last name, role (`Admin` for `role === 'admin'`, `Demo` for a demo user, otherwise
  `Regular`) and a tick for a signature. Each row's "Edit" opens `EditUserModal`, everything pre-filled: first
  name, last name, email, "Grant admin role" and, on a demo user's row only, "Promote to real user" (unticked).
  Save sends only what changed (`patchAdminUser`, `PATCH /v1/admin/users/{id}`: any of `first_name`,
  `last_name`, `email`, `is_admin`, `is_demo: false`) and is off until something has. A name or the email can't
  be cleared, so emptying one that was set is an inline error and nothing is sent.
  - **Sensitive changes are confirmed first:** a new email, the admin role granted or revoked, a promotion from
    demo. The confirmation (`ConfirmDialog` with its `items` list, "Save changes") takes the form's place and
    lists each one; Cancel returns to the form as it was. A change of names alone saves straight away.
  - **The admin's own row** has the admin box disabled, with the tooltip "You cannot change your own admin
    role." (`isSelf`); the backend refuses an admin revoking their own role with a 400 anyway.
  - **A real user can't be made a demo user** (the backend's 400), so the promotion box only appears on demo
    rows and there is no way back from it here.
  - **A refusal shows in the form**, which keeps what was typed: a taken email's 409 reads "Another user already
    has this email." (its `existing_user_uuid` isn't used), anything else "Couldn't save the user: <the
    backend's message>".
  - **After a success** the page reads the list again, re-reads the signed-in user (`refreshUser`) when the
    admin changed themselves, and shows "User <email> updated." in its one-time banner, with the new email when
    it changed.
  - **Deleted users.** "Include deleted" above the table (off to start; the page's only filter) asks the backend
    again with `?include_deleted=true` while it is ticked, and every re-read after a save keeps to it; the table
    stays on screen meanwhile. A deleted user (`deleted_at` set) has their email crossed out and reads Deleted in
    the Role column (the date as a tooltip).
    - **Actions by state.** A live user has Edit, Reset password (not on a demo row) and "Soft-delete", which is
      disabled on the admin's own row with the tooltip "You cannot delete your own account." (the backend's 400).
      A deleted user has "Un-delete" and "Delete forever" instead. Each is confirmed first, a refusal shows in
      its dialog, and after a success the page reads the list again and says so in a toast (not the banner).
    - **Soft-delete** (`softDeleteUser`): the user can no longer sign in and leaves the lists; their IDRs, roles
      and signature stay. Toast: "User <email> deleted."
    - **Un-delete** (`undeleteUser`): toast "User <email> restored." A 409 means another user now has the email;
      it shows as the backend words it, and there is nothing to do about it from the dialog.
    - **Delete forever** (`permanentDeleteUser`): `DeleteForeverModal`, typing the email exactly (capitals
      count, no trimming). The backend only takes a soft-deleted user that nothing names; its 409 carries
      `references` (`idrs`, `project_users`, `audit`, `field_edits`, `attachments`; a signature doesn't count),
      which `historyMessage` words as "User has history and can't be permanently deleted: 3 IDRs, 1 project
      assignment. Keep the user soft-deleted." Toast on success: "User <email> permanently deleted."
  "Create user" (right of the heading) opens `CreateUserModal`: email, first name, last name (optional), a
  password shown as typed (the admin passes it on) and "Grant admin role". Save is off until the email, the
  first name and a password of at least 6 characters are in; `createAdminUser` (`POST /v1/admin/users`) sends
  them. A refusal shows in the dialog as the backend worded it, a taken email's 409 included (its
  `existing_user_uuid` isn't used yet), and the form keeps what was typed. After a success the list is read
  again and a one-time banner names the new email and says to share the password, until it is dismissed or
  another dialog is opened. The new user is on no project until given a role on the project roles page. A non-admin who opens the
  URL is told it is for admins; the backend returns 403 to them anyway.
- **Pay items (admin).** `/admin/projects/:projectId/pay-items` (`AdminPayItemsPage`), reached from "Pay items" on
  an `/admin/projects` row; Back returns there. The project's pay-item catalog, kept by hand: the same rows the
  pay-item picker reads through `GET /v1/contract_items/`.
  - **Load:** `listProjectPayItems` (`services/payItems.js`) and `listAdminProjects` together; the second only
    gives the heading its project name ("Pay Items — <project_id> <project_name>"). A failure of either, an
    unknown project's 404 included, is the load error with Retry.
  - **The table** is in the backend's order (budget code, then ref): pay item ref, description (two lines at
    most, the whole of it as a tooltip), unit, quantity (three decimals at most), unit price (dollars, two
    decimals), budget code, and Edit / Delete. A pay item is `{pay_item_uuid, pay_item_ref, description, unit,
    quantity, unit_price, budget_code, spec_section}`; `spec_section` isn't shown or edited.
  - **Add and Edit** share `PayItemFormModal` (`mode`, `initial`): all six fields required, the unit put in
    capitals on blur, Save off until every field is in and both amounts are numbers of zero or more. It passes
    on all six in both modes, text trimmed and amounts as numbers. A refusal shows in the dialog as the backend
    worded it (a ref the project already has under that budget code is a 409; its `existing_pay_item_uuid`
    isn't used yet) and the form keeps what was typed. After a save the list is read again.
  - **Delete** is confirmed first and then drops the row without reading the list again. **Clear all pay
    items** (off while the list is empty) is confirmed with the count, then reads the list again and shows a
    one-time banner, "Cleared <N> pay items from <project_id>.", until it is dismissed or a dialog is opened
    (the same banner announces an import).
    A refusal of either shows in its dialog. Reports that already use an item keep their copy of it.
  - **Import CSV** (between Clear all and Add; `PayItemImportModal`, which runs both calls itself) is two
    screens in one dialog.
    - **Upload:** a `.csv` file input, the column instructions and Preview. A file over 2 MB is refused here
      (`MAX_IMPORT_BYTES`; the backend's own answer would be a 413). Preview sends the file to
      `previewPayItemImport`; a refusal (a missing column, not UTF-8, ...) shows inline as the backend worded it.
    - **Preview:** "N new | M overwrites | K errors" in green, blue and red, then a callout: red when any row has
      an error, amber when the file has no rows, otherwise green "Ready to import N pay items." Confirm import is
      off for the first two. Errors (open by default) list each row's number, the reason and its cells as typed
      (the backend gives `{row, reason, raw}`, not one offending field). New and Overwrites are folded away; an
      overwrite reads `ref @ budget_code` and an "existing → incoming" line per field that would change
      (`overwriteChanges`: description, unit, quantity, unit price, spec section). Columns the backend ignored
      are named.
    - **Confirm import** sends the same file to `commitPayItemImport`, which reads and checks it again. On
      success the dialog closes, the page shows "Imported X new and Y updated pay items." in its one-time banner
      (from `{inserted, updated}`) and reads the list again. A 400 there means the file no longer passes: the
      dialog returns to Upload with "The file changed since the preview. Re-upload to try again." Any other
      failure shows on the preview, which stays.
    - **Back** returns to Upload with nothing picked (a file input can't be given its file back); Cancel closes
      either screen and changes nothing.
    - The two calls are the app's only multipart requests: `apiFetch` passes a `FormData` body through and
      leaves the `Content-Type` to the browser.
  - The amounts print through `lib/payItemFormat.js` (`formatPayItemQuantity`, `formatUnitPrice`), on the table
    and in the import preview. A non-admin who opens the URL is told it is for admins; the backend returns 403
    to them anyway.
  - **Assessment rates** (`AssessmentRatesCard`, a section above the table, once the list has loaded): the project's
    DOT rates per square foot, "4\" cost / SF" and "7\" cost / SF", pre-filled from the `listAdminProjects` row
    (`cost_per_sf_4in`, `cost_per_sf_7in`; blank for none). Save is off until a rate changed and both are valid
    (`rateOf`: 0 or more, under 1,000,000, 4 decimal places at most, as the backend checks; a blank box clears the
    rate) and sends only what changed (`setAssessmentRates` in `services/projects.js`, `PATCH
    /v1/admin/projects/{id}/assessment-rates`, which returns the project). A refusal reads "Couldn't save the rates:
    ..." under the boxes, which keep what was typed; a success reads "Assessment rates saved." until the next edit.
    The form is `noValidate`: the browser's own step check trips on floating point. Nothing computes with the rates
    yet.
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
  for whatever a project lacks. Nothing on a row is editable. Each row's Actions cell has "Pay items"
  (`/admin/projects/<project_id>/pay-items`), "Site Info" (the project-level `/project/<project_id>/properties`),
  "Task orders" (the project-level `/project/<project_id>/task-orders`) and "Manage roles"
  (`/admin/projects/<project_id>/roles`).
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
- **Properties ("Site Info" in the UI).** `/project/:projectId/properties` (`PropertiesPage`), reached from the
  "Site Info" link in the task orders page's header (and "Site Info" on an `/admin/projects` row); the dashboard
  has no tile for it. Back returns to the project page. The project's properties (where its work is done), kept by
  hand, of two kinds since migration 035: a **sidewalk** (a tax lot, named by its borough, block and lot; R1e.3,
  migration 036, dropped the BBL) and a **ped ramp** (a corner of an intersection).
  - **Naming.** Internally a property is a property: files, components, services, routes (`/properties`), query
    keys and backend fields keep the word. What the user reads says "site": "Site Info" for the list and its
    links, "site" / "sites" in dialogs, confirms, toasts and notes ("Site type: Sidewalk", "Delete site <name>?",
    "Site <name> deleted."), where the name is `siteName` (`lib/properties.js`): a sidewalk's "Queens Block 123 Lot 45"
    (`blockLot`), a ped ramp's `display_address`. Nothing the user reads says "BBL". The task-order pages say "site" too ("Bundled sites", "Add sites", "24 sites", "Unbundle
    site <name>?", the picker), and the task orders list's column is "Sites". Messages the backend words itself
    ("Property not found", "Cannot bundle a deleted property", its 409 details) still say "property" and are shown
    as worded: the backend's entity is still a property, and they appear only on errors. Backlog: if the backend
    entity is ever renamed to sites, update those details then (or have the frontend translate known backend
    wordings).
  - **Who does what.** Since S2 any member of the project reads, adds and edits them; only the destructive
    controls (Delete, Un-delete, Show deleted) are an admin's. A demo user reads only: no Add, Edit or Delete, and
    the note "Demo mode: sites are read-only." (the backend answers 403). The backend refuses anyone not on the
    project (403), which shows as the load error.
  - A property is `{id, project_id, kind, boro, block, lot, address, property_type, violation_no,
    intersection_street_1, intersection_street_2, quadrant, facing_street, ramp_type, notes, display_address,
    created_at, updated_at, created_by, deleted_at, deleted_by}`. A sidewalk has `block` (1-5 digits) and `lot` (1-4),
    stored without leading zeros, `address`, `property_type` and an optional `violation_no`; a ped ramp has the two streets, `quadrant` (`NE` `NW`
    `SE` `SW`), `facing_street` (`street_1` / `street_2`: which of its streets it faces) and `ramp_type`
    (`PERPENDICULAR` `PARALLEL` `CUT_THROUGH`), and none of the sidewalk's. Both have `boro` (the five boroughs
    spelled out), chosen in the form. `display_address` (a sidewalk's address; a ped ramp's "Atlantic Ave & Court St
    — NE Quadrant (Facing Court St)") is the backend's, and the app shows it as sent: `display_address` wherever a site is named by
    its place (the PIR and site page headings, a task order's bundle, the picker). `property_type` is one of
    `1_3_family` ("1-3 family"), `4_plus_family` ("4+ family / commercial") and `expedited` ("Expedited"), in
    `src/data/propertyTypes.js`; the kinds, boroughs, quadrants and ramp types are in `src/data/propertyKinds.js`
    (with `facingStreetName`, `withoutLeadingZeros` and `MAX_BLOCK_DIGITS` / `MAX_LOT_DIGITS`). The list adds `pir_status`, `status` (`{state:
    none | task_ordered | constructed_on, date}`) and `task_order_no`.
  - **Service:** `services/properties.js`: `listProperties(projectId, { includeDeleted })` (both kinds; the
    backend's `?kind=` isn't used), `getProperty`, `createProperty(projectId, data)`, `updateProperty(propertyId,
    data)`, `softDeleteProperty` and `undeleteProperty`. `include_deleted` from a non-admin is ignored by the backend.
  - **Load:** `listProperties` and `listCorners` together, the sites split by `kind` into the two sections; the
    heading is "Site Info — <project_id>".
    A failure is the load error with Retry.
  - **Two sections** (`SiteSection` and `PedRampsSection`, in page order): "Prior Notice Violation Sidewalks" and "Pedestrian Ramps", both
    open on every load (nothing remembers a fold). The header: a button with a chevron and the title with its count
    of live sites ("Prior Notice Violation Sidewalks (12)", `aria-expanded`), which folds the section; then "Bulk
    Upload Sidewalks" / "Bulk Upload Ped Ramps", disabled for everyone with the tooltip "AI import — coming soon"
    (on a wrapper too); then, for a member who isn't a demo user, "Add Sidewalk" / "Add Pedramp". Rows are in the backend's order.
    - Sidewalk columns: Borough, Block, Lot (the site's own `block` and `lot`), CB (`community_board`, a dash for
      none), Address (a link to
      the site's page), Violation No., Status, Added, Task Order No., Actions.
    - **Ped ramps, grouped by corner** (Slice R): the corners in the backend's order (by their streets), each a
      heading row (`tr[data-corner]`): "Atlantic Ave & Court St — NE · Brooklyn · 2 ramps", then "Inspection Report"
      (`DownloadFileButton`, everyone) and, for a member who isn't a demo user, "Add another ramp at this corner" (off,
      with the tooltip "Set this corner's direction first (Edit one of its ramps).", for a corner without a direction:
      the backend reuses a corner by its direction). A live corner with no ramps keeps its heading (so a ramp can be
      added). Ramps whose corner isn't in the list come last under "No corner". Under each heading its ramps:
      Intersection (street 1 & street 2, a link to the site's page), Direction (the ramp's quadrant), Ramp type, Ramp
      label (its Ramp ID, read off the corner's `ramps`), Status, Actions. A cut-through's two ramps are two rows,
      told apart by their Ramp IDs ("CT-A" / "CT-B").
    - **Status** (`SiteStatus`): a dash for `none`, a "Task Ordered" pill, or "Constructed YYYY-MM-DD" with the
      server's date as sent; a deleted row reads Deleted instead. Added is `created_at` through `lib/shortDate.js`;
      a dash for no task order or violation.
    - **Actions:** View (a link to the site's sketch workspace, `/project/<id>/properties/<id>/pir`) for everyone;
      Edit for a member who isn't a demo user; Delete for an admin; a deleted row has only Un-delete (an admin's).
    - **Empty:** "No sidewalks added yet." / "No pedestrian ramps added yet." (no ramps and no live corner), with a
      prominent Add for a member who isn't a demo user.
  - **The Pedramp dialog** (`PedrampSiteModal`, Slice R; "Add Pedramp" / "Add another ramp at this corner" / "Edit
    Pedramp"): one modal, four sections that fold (`FoldingPanel`): A. Location & Corner (borough, the two streets,
    corner direction, T-intersection, traffic control, corner type, corner No., corner ID, number of ramps, painted
    roadway), B. Construction info, C. Inspection (and the corner's comments) and D. This Ramp (quadrant, facing
    street, ramp type, Ramp ID at most 50, notes). Required: borough, both streets, corner direction, quadrant,
    facing street, ramp type. The facing street's options are the two streets' names as typed in A (sent as
    `street_1` = the north-south street, `street_2` = the east-west), disabled until both are in.
    - **Add:** everything open and empty; Save sends every field, flat, to `createPedrampSite`. The backend reuses a
      live corner at the same borough, streets (any case) and direction, as it stands.
    - **Add another ramp:** the corner fills A-C, locked and folded; only D is filled in; Save as Add (the corner's
      own values make the backend reuse it).
    - **Edit** (a ramp row's Edit): one scrolling page, every section open, the corner's and the ramp's values (its
      Ramp ID from the corner's `ramps`). When the corner has more than one ramp a note says A-C apply to all of them.
      Save runs, in turn, `updateCorner` with A-C's changes (the backend writes a new borough or street onto every live
      ramp at it), `updateProperty` with the ramp's own changes and `saveRampLabel` when the Ramp ID changed; each
      only when it has something. A ped ramp without a corner is edited in `PropertyFormModal` instead.
    - **Edit from the site page** (`PropertyPage`'s Edit on a ped ramp at a corner, R.1): mode `edit-ramp`, as Edit but
      A-C locked and folded under "Sections A to C are this corner's: edit them from Site Info.", so a ramp's streets
      never part from its corner's. Save runs `updateProperty` and `saveRampLabel`, then reads the corners again. A ped
      ramp without a corner (or whose corner couldn't be read) keeps `PropertyFormModal`.
    - **Switching the ramp type** (R.2): editing reads the ramp's saved attributes (`getRampAttributes`); choosing a
      type that doesn't take some of their filled measurements (`_pct` / `_in`; `measurementsDropped` in
      `data/pedRampForm.js`) first asks "Change the ramp type?": "Switching from Perpendicular to Parallel will drop
      these measurements:" with the list, Continue / Cancel. Cancel keeps the type it had. The drop itself happens at
      the next save of the attributes (they are saved whole, only the new type's keys). Attributes that can't be read
      ask nothing.
    - **Delete** (an admin's, as for any site) deletes just that ramp. When it was the last live ramp at its live
      corner, a second dialog asks "Delete the corner too?" ("Delete corner" / "Keep corner"; `deleteCorner`).
  - **A sidewalk's Add and Edit** (and Edit of a ped ramp without a corner) use `PropertyFormModal` (`mode`, `kind`, `initial`; "Add sidewalk" / "Add ped ramp" / "Edit
    sidewalk" / "Edit ped ramp"), which branches on the kind (the section's when adding, the property's when
    editing; editing shows it as the fixed line "Site type: Sidewalk" / "Site type: Pedestrian Ramp"). Both kinds
    end with Notes (optional, at most 2,000 characters; blank is `null`, which clears them).
    - Sidewalk: Borough (a select with no default, first and focused; free to change when editing), Block (numeric,
      at most 5 characters, hint "Block number as it appears on the Prior Notice (no leading zeros).") and Lot (at
      most 4, hint "Lot number (no leading zeros)."), each losing its leading zeros when it loses focus (`"00123"` is
      `"123"`, `"0000"` is `"0"`) and sent that way; one that isn't digits turns its hint into the rule ("A block is 1
      to 5 digits.") and keeps Save off. Then "Community Board (CB)" (optional, at most 10 characters; blank is
      `null`), Address, Violation No. (optional; blank is `null`) and "Property type".
    - Ped ramp: Borough, Community Board (CB, as a sidewalk's), Intersection 1st Street, Intersection 2nd Street, Quadrant, Facing (disabled with "Fill in
      both intersection streets to pick the one it faces." until both are in, then the two street names; it sends
      `street_1` / `street_2`) and Type.
    - Save is off until every required field is in and, when editing, something changed. Adding sends `kind` and
      the kind's fields, editing only what changed (a block typed with leading zeros is no change); text is trimmed. The page passes
      the thrown error to the modal, which splits it with `lib/formErrors.js`: a 409 reads "A site at this Borough +
      Block + Lot already exists in this project." above the three (`property-location-error`; all three marked
      invalid and described by it, since the duplicate is the three together), a 422's messages sit under the fields their `loc`
      names, anything else (a 400, the backend's "Property kind cannot be changed. Delete and recreate." included)
      below the form as worded. The form keeps what was typed. After a save the list is read again.
  - **Show deleted** (an admin's checkbox above the sections, off to start) asks the backend again with
    `?include_deleted=true`; the sections stay on screen meanwhile. A deleted row is muted (`text-gray-400`), its
    link crossed out, its status a Deleted badge (the date as a tooltip), and it doesn't count in the title.
  - **Delete** (a soft delete; a sidewalk's frees its borough, block and lot) and **Un-delete** are each confirmed in
    `ConfirmDialog`, a refusal shows in the dialog (an un-delete's 409: another live sidewalk is now at its lot, as
    the backend words it), and after a success
    the list is read again and a toast reads "Site <name> deleted." / "Site <name> restored." The backend takes a
    second soft-delete as a no-op and answers 404 to un-deleting a live property. There is no delete forever.
  - **A task order's bundle** (`PropertiesTable`) and **the picker** (`PropertyPickerModal`) list both kinds: Site
    (`siteLabel`: a sidewalk's "Queens Block 123 Lot 45", "Ped ramp" for a ped ramp; the link to its page), CB
    (the bundle's own column, a dash for none; the picker's "CB QN13" beside the site, only when set),
    `display_address`, and the property type or ramp type. A task order may mix both kinds (Slice R); its page splits
    the bundle by kind, and the picker filters by kind. The picker's search ("Search by block, lot or address")
    matches a sidewalk's block, lot or address, any site's CB, and a ped ramp's `display_address` (its streets).
- **PIRs.** A property's PIR: the DOT survey sheet its inspector signed, digitized by a project member or an
  admin. One live
  PIR per property; a soft-deleted one frees the property for a new one. A PIR is `{id, property_id, project_id,
  source_image_url, source_image_scale, inspector_initials, inspector_sign_date ('YYYY-MM-DD'), digitized_by,
  digitized_at, as_built_signed_by, as_built_signed_at, created_at, updated_at, deleted_at, deleted_by}`; the image
  fields and the as-built signature are set by later slices, never by this page.
  - **Service:** `services/pirs.js`: `getPirByProperty(propertyId)` (the live PIR, or `null` on a 404, which an
    unknown property gives too), `listPirs(propertyId, { includeDeleted })` (newest first), `getPir`,
    `createPir(propertyId, {inspector_initials, inspector_sign_date})`, `updatePir`, `softDeletePir` and
    `undeletePir`. Reading, creating and editing are for anyone on the project; deleting and un-deleting for an
    admin.
  - **One property:** `/project/:projectId/properties/:propertyId` (`PropertyPage`), from a site's link in
    Site Info or a task order's bundle, for anyone on the project; Back ("Back to
    Site Info — <project_id>") returns to the project's properties; beside it "Back to task order <number>" opens the
    latest live task order the site is in (`task_order_id` on `getProperty`'s answer, kept across the site's writes,
    whose answers don't carry it), greyed out and titled "Not in a task order" when it is in none. **Back to report
    (U3):** opened with `?returnTo=<an IDR report page>` (`withReturnTo` builds the link; `readReturnTo` follows only a
    relative path starting with `/project/`, no `//`, no backslash), it also shows "Back to report"
    (`BackToReportButton`), which goes there; the other back buttons stay, and "Open sketch workspace" carries
    `returnTo` along. Under the PIR card, **Work history** (`WorkHistorySection`, Slice V2): every IDR that imported
    the site, newest work date first, "Excavation on 10/19/26 reported by Genghis Khan, IDR# 123AB" (Other's text in
    quotes, "Draft" without a number), a deleted IDR's line struck and marked (deleted), a returned one marked
    (returned). One `getProperty` and one
    `listPirs(…, { includeDeleted: true })` (the backend gives a non-admin only the live one). The heading is
    "<project_id> · <display_address>". The Site card (the property's) lists the borough, then a sidewalk's block, lot,
    CB, address, violation no. and type or a ped ramp's CB, intersection, quadrant, facing street and ramp type, then notes
    and added, with Edit (`PropertyFormModal`) for a member and Delete for an admin; a deleted property reads Deleted, gets no Add PIR
    (the backend refuses a PIR on it with a 400), and is the admin's: they get Un-delete (and Edit PIR on its live
    PIR), anyone else no controls (the backend answers them 400). A demo user gets no controls and the note "Demo
    mode: sites and PIRs are read-only."
  - **The PIR card** carries the status badge in its heading. With a live PIR: the way into its workspace
    (`PirWorkspaceLink`: the page count and "Open sketch workspace"; see PIR pages), then inspector initials, signed on, digitized
    ("Sep 20 by <name>") and as-built ("Not yet confirmed", or "As-built signed by <name> on <date>"), with Edit PIR
    for a member and Delete PIR for an admin. Without one: "No PIR yet." and, for a member, Add PIR. Names come
    from `useUserNames` (an admin's list with deleted users, or the members' list); when it fails or lacks the
    user, the date stands alone.
  - **Deleted PIRs** (an admin's) are listed under the card, muted and struck ("JD, signed Sep 14 · deleted Oct 3"), each with
    Un-delete. While the property has a live PIR, Un-delete is off with the tooltip "This site has a live PIR.
    Delete it first to restore this one." (the backend's 409 otherwise).
  - **`PirFormModal`** (`mode`, `initial`; "Add PIR" / "Edit PIR"): inspector initials (trimmed, at most 16) and
    inspector sign date, both required. Save is off until both are in and, when editing, something changed;
    editing sends only what changed. A 409 (the property got a live PIR since the page loaded) reads "This
    site already has a PIR. Cancel to see it." below the form, and the page reads the PIRs again behind the
    dialog; a 400 reads as the backend worded it; a 422 sits under its field (`lib/formErrors.js`, whose 409 can
    now name no field). Creating after a delete is not a 409: the deleted PIR freed the property.
  - Every delete and un-delete (the property's and the PIR's) is confirmed in `ConfirmDialog`; a refusal shows
    there; the toasts read "Site <name> deleted." / "restored." and "PIR deleted." / "PIR restored.". After a
    PIR change the page reads the PIRs again; after a property change it shows the property the call returned.
  - **The status badge** (`PirStatusBadge`, from `pirStatus` in `lib/pirs.js`): a dash for no live PIR, "Signed by
    DOT" (blue) for a live PIR whose as-built isn't signed, "As-built signed" (green) once it is. It takes the PIR
    (`pir`), or a status key (`status`), which the properties list reads off each row's `pir_status`
    (`pirStatusFromApi`: `none`, `dot_signed`, `as_built_signed`; anything else is none).
- **PIR pages (the PIR sketch workspace).** `PirPage` is a multi-page sketch workspace: a PIR's scanned survey
  sheet, as pages, with its flags drawn over them. The pages: a PDF (any number of pages, up to the
  backend's cap, 15) or a PNG / JPEG (one page), each page rendered to PNG by the backend and stored in Supabase
  Storage (private bucket `pir-images`, 10 MB per upload). A page is `{pir_page_id, pir_id, page_number, image_url (a
  signed URL, an hour), image_url_expires_at, image_mime, width_px, height_px, scale_px_per_ft (or null),
  rotation_deg (0, 90, 180, 270), created_at, updated_at, deleted_at, deleted_by}`.
  - **Service:** `services/pirPages.js`. `uploadPir(pirId, file, { scale, onProgress })` runs the house two-step
    upload (the API can't take a body over 4.5 MB on Vercel): `requestPirUpload` (`POST /image/upload-request` with
    `{mime, filename, size_bytes}`) → `putPirFile` (a PUT straight to the signed Storage URL, not through
    `apiFetch`) → `completePirUpload` (`POST /image/complete` with `{staging_path, scale_px_per_ft?}`), which
    returns the PIR with its `pages`. `onProgress` gets `requesting`, `uploading`, `rendering`. A new upload
    replaces every page, and the flags drawn on the old ones are deleted. `listPirPages(pirId)`,
    `deletePirPages(pirId)` (204; the flags go too), `setPirPageScale(pageId, scale)`, `setPirPageRotation(pageId,
    degrees)` (`PATCH /v1/pir-pages/{id}/scale` and `/rotation`, each returning the page), `nextRotation` (0 → 90 →
    180 → 270 → 0), `validatePirFile` / `pirFileTypeOf` (a PDF, PNG or JPEG by declared type or, failing that,
    extension; not empty; 10 MB at most). The R1d routes (`GET` / `PATCH` / `DELETE /image`, the `content_type`,
    `upload_path` and `scale` names) are deprecated and the frontend doesn't call them.
  - **`PirPage`**, `/project/:projectId/properties/:propertyId/pir`, from "Open sketch workspace" on the property
    page's PIR card (`PirWorkspaceLink`, which shows the page count: "3 pages", "No pages uploaded yet"). Back
    ("Back to Site <siteName>") returns to the property, with `GoToProjectButton` beside it; with `?returnTo=`, also
    "Back to report" (`BackToReportButton`), and Back to Site carries `returnTo` along (U3). One `getProperty` and one
    `getPirByProperty`, then `listPirPages`; a failure (a non-member's 403 included) is the load error with Retry.
    The heading is "PIR · <display_address>" with the PIR's status badge. Without a live PIR: "This site has no PIR yet. Add
    one on the site page first." `?flag=<id>` (`sketchLink` in `lib/idrFlags.js`) selects that flag to start.
    Under the sketch area, **Pay Items Reported** (`PayItemsReportedSection`, Slice V5), read-only: each pay item IDRs
    report on the site (`getPropertyPayItemSummary`), its total and unit, its IDR count ("1 IDR", "3 IDRs"; W2) expanding to "IDR-005 ·
    10/20/26 · 40 SF · Jane Doe" lines, newest first, each number linking to its IDR ("Draft" without one, "(in
    progress)" before approval).
    - **Pages:** Prev / Next and "Page n of N", and the `[` and `]` keys (not while a dialog is open or a field has
      the focus). The page shown is `?page=` (replaced, not pushed); a number out of range shows the nearest page.
      Each page shows at its rotation in the sketch workspace (`SketchWorkspace`; see Flags) with "Scale: 15 px/ft"
      ("not set" without one). If its image fails to load (an expired link), "Reload pages" reads them again.
    - **A writer** (a member who isn't a demo user; while the site is deleted only an admin) also gets Rotate (a
      quarter turn clockwise, PATCHed on that page; a refusal shows above the page), Set scale (`PageScaleModal`:
      a number above 0, "Applies to page {n}."), Replace PIR (the upload dialog, warning that the pages and their
      flags go) and Remove pages (confirmed). With no pages the card reads "Upload PIR (image or PDF, any number of
      pages)." with Upload PIR. After an upload the page lands on page 1 and toasts "PIR uploaded: 2 pages." /
      "PIR replaced: ...". For a reader (a demo user, or anyone but an admin on a deleted site) these controls are
      there but disabled; a demo user reads "Demo mode: sites and PIRs are read-only."
  - **`PirUploadModal`** (`pirId`, `replacing`, `onUploaded`, `onClose`; "Upload PIR" / "Replace PIR"): a file input
    (`.pdf,.png,.jpg,.jpeg`), the file's name and size, a size or type refusal at once, and an optional scale for
    every page (15 to start, at least 1; blank leaves it to each page). A picked image is previewed from the file.
    The spinner names the step: "Preparing upload...", "Uploading file...", then "Rendering..." (the page count only
    comes back with the response). A 413 reads "The file is too large: a PIR file is 10 MB at most.", anything else
    (a cap: too many pages, a page too large) as the backend worded it, and the dialog keeps the file and scale.
  - **Rotation and coordinates (the convention).** A flag's `sketch_x`, `sketch_y` and `rotation` are in the page's
    native, unrotated pixel space: x right and y down from the PNG's top-left corner as uploaded, 0..`width_px` and
    0..`height_px`, whatever the page's `rotation_deg`. `sketch_x` / `sketch_y` is the centre of the shape's bounding
    box; `rotation` is the shape's own turn about it, in degrees clockwise. `RotatedPage` draws the image in a box of
    the page's native proportions and turns that box with `transform: rotate(<deg>deg)` inside an outer box of the
    rotated proportions (width and height swapped at 90 / 270; `lib/pageGeometry.js` `rotatedSize`). The SVG overlay
    (`viewBox="0 0 width_px height_px"`) sits in the same box, so it gets the same transform as the image and stored
    positions stay valid at every rotation. A pointer's position goes the other way through `toNativeCoords`
    (relative to the outer box's centre, scaled back, turned back). Checked in a browser: overlay and image agree
    to within 2 px at all four rotations.
- **Flags.** A PIR's flags: the sidewalk pieces its survey sheet marks, each a shape with dimensions in feet, drawn
  on one of its pages in the sketch workspace (`SketchWorkspace`, on `PirPage` under the page controls).
  - **A flag** is `{id, pir_id, pir_page_id, property_id, project_id, display_order, added_in_field, shape,
    dimensions, sketch_x, sketch_y, rotation, surveyed_mark, surveyed_is_assessable, surveyed_non_assessable_reason,
    surveyed_thickness, is_constructed, pay_item_id, computed_quantity, reported_quantity, quantity, is_overridden,
    quantity_delta_reason, created_at, updated_at, created_by, deleted_at, deleted_by, claimed_by_idr_id,
    claimed_by_idr_number, constructed_on}`. Only an IDR's approval sets `is_constructed` and the claim (see IDR
    flags); nothing here edits them. A claimed flag carries an "IDR #042" badge at its top-right on the canvas
    (green, `claimBadgeText`; a link, Enter too) and "Claimed by IDR 042 · constructed Oct 3" under its panel's
    heading; either opens the IDR (`onOpenIdr`, which `PirPage` turns into a navigation). A claimed flag can still
    be edited: the IDR keeps what it signed off on. Flags made before pages (R1b's form) were soft-deleted by migration 033 and can't come back.
  - **Service:** `services/flags.js`: `listFlags(pirId)` (the live flags across the live pages, by display order),
    `getFlag`, `createFlagOnPage(pirPageId, data)`, `updateFlag` and `deleteFlag` (a soft delete, for any member).
    The admin's soft-delete / un-delete routes and the deprecated `POST /v1/pirs/{id}/flags` aren't called.
  - **Shapes and dimensions** (`dimensions`, feet, every length above zero), and the area the backend stores as
    `computed_quantity` (square feet, to the cent, halves up; the panel shows the backend's). `lib/flagArea.js`
    `computeArea` has the same formulas:
    - rectangle `{L, W}`: L × W
    - trapezoid `{a, b, w}` (the parallel edges and the width between them): (a + b) / 2 × w
    - triangle `{a, b}` (a right triangle's legs): a × b / 2
    - polygon `{vertices: [{x, y}, ...]}` (three or more, in order, enclosing an area): the shoelace formula
    - arc `{r, theta}` (a circular segment; θ in radians, above 0 and at most 2π): r² / 2 × (θ − sin θ). The panel
      takes θ in degrees and converts.
    `lib/flagGeometry.js` draws them (`shapeOutline`, in feet: a trapezoid's a on top, a triangle's right angle at
    the bottom left, an arc's chord at the bottom); `flagOutline` centres that on (sketch_x, sketch_y), scales it by
    the page's px/ft and turns it by `rotation`. A page without a scale draws no flags and takes none.
  - **Classifications** (`src/data/flagEnums.js`, the backend's values with the app's labels): shape; surveyed mark
    (`number_only` "Number only", `cross` "Cross (X)", `cross_with_number` "Cross + number", `tick`, `none`);
    non-assessable reason (`tree_damage`, `city_tree`, `transition`, `no_driveway`, `hydrant`, `fronting_city`
    "Fronting city property", `utility`, `settlement`, `other`, then the Smart PIR survey's, which migration 034
    added: `tree`, `driveway`, `grass`, `dirt`, `existing_sidewalk`, `asphalt`, `tree_pit`, `landmark`, `vault`,
    `subway`, `scaffolding`, `other_perm_obstruction`, `other_temp_obstruction`); thickness (`4in` '4"', `7in_as_4in`
    '7" as 4"', `7in` '7"'); defect codes (`DEFECT_CODES`: `1` to `5`, `6A`, `6B`, `6C`, read off `defect_codes`
    and not edited yet). The reason labels are the app's own wording of the backend's keys.
  - **The survey's rules** (the backend's 422s; the panel only sends what keeps them): an assessable flag has no
    non-assessable reason and any other has one; the mark is `none` exactly when the flag was added in the field;
    a reported quantity is above zero.
  - **`SketchWorkspace`** (`pir`, `page`, `pages`, `writer`, `onPageSaved`, `onJump`,
    `onImageError`; keyed by the page ids, so a new upload reads afresh): reads `listFlags` and `getContractItems`
    once, with the Smart PIR drawings (see Smart PIR drawings). Above the page, `ShapeToolbar`, `CalibrateControl`
    and the coming tool (Auto-detect with AI); then `SketchCanvas` beside the selected flag's `FlagPanel` (else "Pick a
    shape and click the page to add a flag, or select one to edit it."); under them `FlagsFallbackList`.
    - **`ShapeToolbar`**: a toggle per shape (rectangle, trapezoid, right triangle, polygon, arc) and the thickness
      legend. Picking one arms it (the cursor is a crosshair over the page) until it is picked again or Esc. Off
      without a scale ("Set this page's scale (or calibrate) to draw flags.") or while calibrating.
    - **Placing:** a click on empty page with a shape armed POSTs `createFlagOnPage` with `newFlagValues`: the next
      display order, the shape's default dimensions (`DEFAULT_DIMENSIONS`: a 5 × 5 ft rectangle, a 4 / 6 × 5 ft
      trapezoid, 5 × 5 ft legs, a 5 ft square polygon, a half circle of 5 ft radius), centred on the click, rotation
      0, `number_only`, assessable, `4in`, not added in field. The new flag is selected; the shape stays armed.
    - **`SketchCanvas`**: the page (`RotatedPage`) and the SVG overlay. Each flag on the page is its outline
      stroked in its thickness's colour (`THICKNESS_COLORS`: 4" blue, 7" as 4" amber, 7" red) and filled as the DOT
      report fills it (see Smart PIR drawings), its display order in an orange circle; the selected one is heavier
      and dashed. Clicking a flag selects it; clicking empty page clears the selection
      (or, with a shape armed, places one there). A press on a flag never places a shape, so a just-placed flag can
      be nudged without Esc. Dragging a flag that is already selected, shape armed or not, moves only the overlay; letting go PATCHes `sketch_x` / `sketch_y`
      (a refusal puts it back and says so above the page); Esc mid-drag puts it back. The Delete key (or the panel's
      "Delete flag") deletes the selected flag at once, toast "Flag #<n> deleted.". `showCorners` marks (0, 0) and
      (width, height), for checking alignment by eye.
    - **`FlagPanel`** (`flag`, `contractItems`, `writer`, `onSaved`, `onDelete`; keyed by the flag): display order;
      shape (a new one starts from its default dimensions, sent with them) and its dimensions (a polygon's vertex
      rows, Add vertex / remove, never fewer than three; an arc's angle in degrees); rotation (degrees); surveyed
      mark (radios: the four marks that aren't `none`); "Added in field" (sends `none` with it, and "Number only"
      back when unticked); "Assessable" (unticked, the reason select must be picked before anything is sent);
      surveyed thickness (radios); pay item (`ContractItemPicker`); the computed area; reported quantity (blank or
      "Clear override" reverts to the computed area) and quantity delta reason. Each change waits 300 ms
      (`SAVE_DELAY_MS`) for the next and they go in one PATCH; a pending one is sent when another flag is selected.
      Nothing out of range is sent (a hint says why); a refusal reads "Couldn't save the flag: ..." at the top.
    - **`CalibrateControl`**: "Calibrate" toggles the mode. The canvas takes two clicks (a click on a flag counts),
      marks them and joins them with a thin line; then "Calibrate scale" asks for the distance in feet and sets the
      page's scale to pixel distance / feet (`setPirPageScale`; the points are native pixels, so the rotation doesn't
      matter). Esc or Cancel leaves it; a refusal stays in the dialog.
    - **`FlagsFallbackList`** (R1b's `FlagsSection`, repurposed): every flag across the pages, read-only, by page
      then display order: Page, #, Shape, Thickness, Pay item ("item no — description", "—" for none, "Not in the
      catalog"), Area (computed), Reported. Clicking a row (or Enter) goes to its page (`?page=`) and selects it.
      No flags reads "No flags yet."
  - **`ContractItemPicker`** (`items`, `value`, `onChange`): the picked contract item as "item no — description"
    with Change and Clear, or "No pay item" with Choose. Choose opens a panel with a search box (item no. or
    description, any case) and one entry per contract item, its budget code beside it: `pay_item_id` is a
    `contract_item_id`, and the same item no. under two budget codes is two contract items. (The report forms'
    `PayItemPicker` groups by item no., so it can't pick one contract item.)
  - **Who does what:** any member of the project reads, adds, edits, moves and deletes flags. A reader (a demo
    user, or anyone but an admin while the site is deleted) sees the same workspace with the toolbar, Calibrate and
    the panel disabled, no Delete flag, and neither drags nor deletes. There is no un-delete in the UI.
- **Smart PIR drawings (R1e.1).** What else migration 034 lets a PIR's page carry, drawn on the sketch: a flag's
  non-assessable areas, features and curb segments, each flag's defect codes and the DOT report's fills and labels.
  **Rendering only:** nothing here is edited in the UI yet (R1e.2), only imported.
  - **Services** (reading only): `listPirFeatures(pirId)` (`services/features.js`) and `listPirSegments(pirId)`
    (`services/segments.js`), each the PIR's live ones on its live pages; `listFlagNonAssessableAreas(flagId)`
    (`services/nonAssessableAreas.js`). There is no list of areas per PIR, so `SketchWorkspace` asks only each flag
    whose `non_assessable_areas_count` is above 0, and a failure of any of these is the workspace's load error. A
    feature is `{feature_id, pir_page_id, feature_type, area_impact (marker_only, subtract, sits_on_top),
    sketch_x, sketch_y, rotation, shape, dimensions, label, flag_id, ...}`, a segment `{segment_id, pir_page_id,
    segment_type, points: [{x, y}, ...], length_ft, note, ...}`, an area `{non_assessable_area_id, flag_id,
    display_order, shape, dimensions, sketch_x, sketch_y, rotation, reason, ...}`: page pixels and feet, as a
    flag's. Their type lists are in `src/data/flagEnums.js` (`FEATURE_TYPES`, `SEGMENT_TYPES`, `AREA_REASONS`). Flags
    now also carry `defect_codes`, `non_assessable_areas_count`, `net_quantity` (the area less its areas and
    subtracted features) and `quantity` (the override, else the net area); the panel still calls the area
    "computed".
  - **`SketchCanvas` layers**, bottom to top, all but the flags taking no clicks:
    - **Segments:** a polyline per curb run, stroked by type (`SEGMENT_STYLES`: concrete solid, depressed dashed,
      steel-faced heavier blue, its corner dash-dotted, granite dotted, other light dashed).
    - **Flags**, filled by `flagFill` in `lib/flagGroups.js`: light-blue stipple for a new 4" assessable flag (a 7"
      assessed as 4" too), white for a new 7", tan hatch for one that isn't assessable, which also gets an X. The
      patterns are `SketchPatterns`' `<defs>`, ids prefixed per canvas (`useId`), at a fill opacity that leaves the
      scan visible.
    - **Non-assessable areas** in yellow stripes, labelled A1, A2, ... at render time (`labelledAreas`: by their
      flag's display order, then their own, across the page); an area whose flag isn't on the page isn't drawn.
    - **Features** (`FeatureGlyph`): a sized one's outline (dashed and whitened for `subtract`, solid for
      `sits_on_top`, a feature's `circle` shape included), then its key symbol at its place: letters for most
      (`FEATURE_LETTERS`: U, MH, FA, M, S, MB, TEL, CD, T, ? for other), a filled dot for a hydrant, a ringed dot
      for a pole, a barred square for a grate, nine purple dots for a detectable warning unit, and its label.
    - **Flag marks:** the display order in an orange circle at the outline's top-left, and the defect codes
      ("1 6A") in its middle.
    - **Group labels** (`thicknessRuns`): "4\" Conc." / "7\" Conc." on each run of consecutive flags (by display
      order) of one slab, a 7" assessed as 4" counting as 7"; at the middle of the run's bounding box, or just
      under a run of one flag so it stays off that flag's marks.
  - **`SketchLegend`**, always shown, unturned, in the lower-left of the page (`RotatedPage`'s `frame`): the four
    fills, the X, the flag-number circle and a north "+". Nothing records which way north is, so the "+" is only
    in the legend.
  - **The import** is the admin's own page now (see Import Smart PIRs below), not a workspace button: a dev / admin
    tool for seeding and backups, kept out of the site workflow.
  - **The coming tool**, always disabled, its tooltip on the button and a wrapper (a disabled button shows none in
    some browsers): "Auto-detect with AI" ("Available when Vercel Pro is enabled (R1k)."). Bulk upload sits on Site
    Info (each section's disabled "Bulk Upload ..." button).
  - Not used yet: the areas', features' and segments' writes, and the page title block (`GET` / `PUT
    /v1/pir-pages/{id}/annotations`), which only the import sets.
- **Import Smart PIRs (admin).** `/admin/import-smart-pirs` (`AdminImportSmartPirsPage`), "Import Smart PIRs
  (Admin)" in the user menu, which only an admin sees. One card, `SmartPirImportForm`: a PIR id (a UUID, checked
  here: "A PIR id is a UUID, ...") and a `.json` file, read and parsed in the browser (a file that isn't JSON reads
  "This file isn't valid JSON: ..." and sends nothing), then `importSmartPir(pirId, parsed)` (`services/pirs.js`,
  `POST /v1/pirs/{id}/import`). A refusal (a 404 for an unknown PIR, a 422 for a file that isn't a Smart PIR import,
  a 400 for another PIR's file) reads "Couldn't import the file: ..." and the id and file stay. On success the card
  shows "Imported 4 flags, 2 non-assessable areas, ... and 1 title block into PIR <id>." (`countsText`), "Set the
  scale, rotation or title block of N pages." when it did, and the dropped items in an amber box, each with where
  it was, counted from 1 (`droppedPlace`: "Page 1, flag 4", "Page 1, flag 1, non-assessable area 2", "The file's
  title block") and the backend's reason; "Import another file" starts again. Imports add: nothing drawn changes.
  A workspace open on that PIR elsewhere shows the import on its next load. A non-admin who opens the URL is told
  "Only an admin can import Smart PIR files."; the backend itself takes an import from any member but a demo user,
  so the admin-only rule is this page's.
- **Task orders.** A project's task orders, each a bundle of its properties (a property can be in several, once
  in each). A project-level feature since S1: any member of the project uses them; only the destructive controls are
  an admin's. A task order is `{id, project_id, task_order_number, issued_date ('YYYY-MM-DD' or null),
  estimate_notes, created_at, updated_at, created_by, deleted_at, deleted_by}`; a list row adds `property_count`
  (and `sidewalk_count` and `ped_ramp_count`, Slice R),
  and one read on its own adds `properties` (its bundled properties that aren't deleted, by address).
  - **Who does what** (the backend enforces all of it; the pages only hide what it would refuse):
    - Any member of the project (inspector, OE, RE) and an admin: list, read, add, edit, bundle and unbundle.
    - An admin only: Delete (a soft delete), Un-delete and "Show deleted". For anyone else these are hidden, not
      disabled, and their list never asks for deleted task orders. A non-admin who opens a deleted task order by
      URL sees it read-only (the backend answers 400 to their edits on it).
    - A demo user: read only (the backend's 403). No Add, Edit, Add sites or Unbundle, the list drops its
      Actions column, and both pages say "Demo mode: task orders are read-only."
    - Someone not on the project: the backend's 403, shown as the page's load error with Retry, as on Progress.
  - **Service:** `services/taskOrders.js`: `listTaskOrders(projectId, { includeDeleted })`, `getTaskOrder`,
    `createTaskOrder`, `updateTaskOrder`, `softDeleteTaskOrder`, `undeleteTaskOrder`, `bundleProperty(taskOrderId,
    propertyId)` and `unbundleProperty`.
  - **The list:** `/project/:projectId/task-orders` (`TaskOrdersPage`), reached from the dashboard's last tile
    (after Progress), which reads "Task Order" over a smaller, muted, normal-weight "for Sidewalk and Ped-Ramp"
    (`text-sm text-gray-500`), and from "Task orders" on an `/admin/projects` row. Back ("Back to Project Page")
    returns to the dashboard. "Task Orders — <project_id>" (no project name, as on Progress); on its right a
    plain "Site Info" link (small construction-coloured text, not a button) to `/project/<id>/properties`, for
    everyone, demo users included, then "Add task order". The table, in the backend's order (by number): Number (a link to the task order's page), Issued
    (`shortDate`, or a dash), Sites (`propertyCount`: "24 sites", "1 site", then `SiteKindBadges`: an "SW" pill when it
    bundles live sidewalks, a "PR" pill for ped ramps, both for a mixed one, each with its count as a tooltip) and
    Edit (and Delete, for an admin).
    "Show deleted", the muted deleted rows with Un-delete, the confirm dialogs, the toasts ("Task order <number>
    deleted." / "restored."), reading the list again after every change and the load error are as on the
    properties page. No task orders reads "No task orders yet. Click 'Add task order' to start." ("No task orders
    yet." for a demo user).
  - **`TaskOrderFormModal`** (`mode`, `initial`; "Add task order" / "Edit task order"): Number (required), Issued
    date (a date input) and Estimate notes (placeholder "Rough bid estimate — 4" SF, 7" SF, curb LF"), both
    optional. Save is off until the number is in and, when editing, something changed; adding sends all three,
    editing only what changed, a blank date or blank notes as `null` (which clears them). A 409 reads "A task
    order with this number already exists in this project." under Number (its `existing_task_order_id` isn't
    used yet); a 422 (a malformed date) under its field; anything else below the form.
  - **One task order:** `/project/:projectId/task-orders/:taskOrderId` (`TaskOrderPage`), from a number on the
    list. "Back to Task Orders" returns to the list, with `GoToProjectButton` beside it. A task order of another
    project under this URL is refused as "Task order not found in project <id>". "Task order <number>" with Edit
    (and Delete, for an admin); a card with Issued, Estimate notes (line breaks kept) and Created ("Sep 1, 2026 by
    <name>"; the name comes from `useUserNames`, and when that fails or doesn't have them the card gives the date
    alone). Then "Bundled sites": "N sites bundled", then two panels that fold (`FoldingPanel`, both open):
    "Sidewalks (N)" (`PropertiesTable` as before) and "Pedestrian Ramps (N)" (`PropertiesTable kind="ped_ramp"`:
    Intersection, Quadrant, Facing, Ramp type, Added), each with Unbundle on each row and its own empty line ("No
    sidewalks in this task order." / "No pedestrian ramps in this task order."), and "Add sites". A site's block and lot ("Ped ramp" for a ped ramp) link to the property's page (`/project/<project_id>/properties/<id>`), which is open
    to anyone on the project. Nothing bundled reads "No sites bundled yet. Click 'Add sites' to pick from this
    project." Its Added column is when the property was added to the project: the response doesn't carry when it
    was bundled.
    - Edit uses the same dialog; Delete, Un-delete and Unbundle are each confirmed in `ConfirmDialog`, a refusal
      shows in the dialog, and the page then shows the task order the call returned (Unbundle answers 204, so
      the page reads it again). Toasts: "Task order <number> deleted." / "restored.", "Site <name>
      unbundled."
    - **A deleted task order** reads Deleted (the number crossed out) and can't be changed: an admin gets only
      Un-delete, anyone else nothing. Add sites and Unbundle are hidden (the backend refuses bundling into
      it). Un-deleting brings its bundle back.
    - A property soft-deleted after it was bundled stays in the bundle but is left out of `properties` and
      `property_count` by the backend, so it disappears from the page until it is un-deleted.
  - **`PropertyPickerModal`** (`taskOrder`, `onClose`, `onDone`), from Add sites (its title too): reads the project's live
    properties (`listProperties`, which any member may) and leaves out those already in this task order. One
    checkbox row each (block and lot, address, type). Chips "All" / "Sidewalks" / "Pedramps" (`aria-pressed`, All to
    start) narrow the rows to one kind, together with the search. The search box keeps the rows whose block, lot or address holds the text, any
    case. "Select all shown" ticks every row shown; a ticked row stays ticked while the search hides it, and Clear
    selection unticks all. "Add N sites" bundles the ticked ones **one at a time** (never in parallel), in
    list order, and stops at the first refusal, so nothing after it is tried. Then the picker closes and
    `onDone({added, failed, taskOrder})` hands the page the count, the refusal (`{property, message}`) and the last
    task order the backend returned; the page shows that and a toast: "Added 3 sites." or "Added 1 site.
    Couldn't add <name>: <message> The rest weren't tried."
- **Imported sites (Slice U2).** A report imports the sites (properties of the IDR's project) whose PIR flags and curb
  segments the IDR covers, each with the work done there; the description can be written from them.
  - **Service:** `services/reportSites.js`: `listReportSites(idrId, reportId)`, `importReportSite(idrId, reportId,
    {property_id, work_type, work_type_other})`, `updateReportSite(idrId, reportId, siteId, {work_type,
    work_type_other})` and `removeReportSite`. `work_type` is `concrete`, `excavation`, `pavement_restoration` or
    `other` (with its text, at most 200). A site is in one report of an IDR at most (409 with `existing_report_id`);
    an import is also 409 when a report holds by hand a pay item the site's flags or segments fill. Who changes them:
    as for an IDR's flags (the backend's `attribution_editor`); the UI offers them on a draft only.
  - **Where:** SWCB only for the pilot (the backend also takes General, AC, Conc Mix and Conc Cyl, not DSP).
    `ImportedSitesSection` (in `components/reports/`), above Pay Items, loaded by `lib/useReportSites.js`: a row per
    site with an SW / PR badge, its `display_address` linking to the site page with `?returnTo=` the report, the work
    (a select; Other shows a Specify box, saved when it loses focus with text in it) and Remove (confirmed: "Its PIR
    flags and curb segments leave this IDR."). Read-only past draft.
  - **Picker:** `ReportSitePickerModal`: the project's sites, a search (address, intersection, block, lot, CB), kind
    chips, a task-order filter (the IDR's own to start, "All task orders" otherwise) and the work to record for all
    picked. A site any report of the IDR already imported is disabled, titled "Already in General (page 1) on this
    IDR." Imports one at a time and stops at the first refusal.
  - **Description** (`lib/reportSites.js`, `descriptionFromSites`): a sentence per site, joined by ". ", ending ".":
    "Sidewalk concrete was placed at {address}" / "Ped ramp concrete was placed at {quadrant} corner of
    {street 1}/{street 2}"; "Excavation at ..."; "Pavement restoration at ..."; "{other text} at ...". The first import
    into an empty description writes it; otherwise the description is left alone. "Regenerate from sites", above the
    textarea (`DescriptionSection`'s `onRegenerate`), replaces it on click. Removing a site or changing its work
    doesn't touch the description. The text is saved with the report as any edit is.
  - **Last updated (Slice V2):** a column, "Jane Doe · 10/20/26 2:05 PM": who last changed the site's work and when
    (`updated_by_name`, `updated_at`), else who added it (`added_by_name`, `added_at`); `lastUpdated` in
    `ImportedSitesSection`.
  - **Site pay items (Slice V1):** each row's "Pay items (N)" (N counted from the totals' `site_lines`) opens
    `SitePayItemsEditor` beneath it: the site's pay items (`listSitePayItems`), and on a draft a contract-item picker,
    quantity (above 0) and note to add one (`addSitePayItem`), the quantity and note saved on blur
    (`updateSitePayItem`) and Remove (`removeSitePayItem`); `services/reportSitePayItems.js`. Not checked against the
    site's flags; the backend refuses a report save holding by hand a pay item a site holds (400 naming the sites).
  - **Pay item totals (V1):** `PayItemTotalsSection`, under Imported sites on the SWCB, display only:
    `getPayItemSources(idrId, reportId)` (`lib/usePayItemSources.js`, reloaded after a site or its pay items change and
    after a save), a row per pay item with its total over the IDR's flags, curb segments, site pay items and this
    report's own (as saved), each expanding ("Source breakdown") to its sources, the sites named.
  - **Toggles on a read-only report:** "Pay items (N)" and "Source breakdown" are `DisclosureToggle`s (a span with the
    button role), which the read-only page's disabled fieldset doesn't disable. user-event refuses to click inside a
    disabled fieldset, so tests of them on a read-only report use `fireEvent.click`.
- **IDR flags (R1f).** An IDR's sidewalk quantities come from the PIR flags it covers, as a live rollup, beside its
  reports' hand-entered pay items.
  - **Scope (Slice U).** An IDR covers the live flags on the sites its reports imported (see Imported sites), without
    one none; the task order (`task_order_id`) no longer sets it. Per-IDR overrides change that: `exclude` leaves a flag
    out, `include` brings one in (the backend also lets an include bring a flag in from elsewhere in the project;
    the UI has no picker for that yet, so it only re-includes listed flags).
  - **Service:** `services/idrSegments.js` (curb billing): `getIdrSegments`, `excludeIdrSegment`,
    `includeIdrSegment`, the same shape with `segments` (each with `segment_type`, `length_ft`, `amount` in LF) and
    pay items' `segment_count`.
  - **Service:** `services/idrFlags.js`: `getIdrFlags(idrId)`, `excludeIdrFlag(idrId, flagId)` and
    `includeIdrFlag`, each answering `{idr_id, status, task_order_id, frozen, counts: {attributed, excluded,
    claimed_elsewhere, total}, flags, pay_items, unmapped}`. A flag's `state` is `attributed`, `excluded`, `claimed`
    (by this IDR, approved) or `claimed_elsewhere`; its `amount` is in its pay item's unit (SF, SY, CY, EA), else
    null. Before approval the answer is live; once approved (`frozen`) it is what the approval claimed and wrote.
  - **No section on the IDR page (U3).** The "Flags attributed (N of M)" panel (`IdrFlagsSection`, with its
    task-order picker, flag and curb-segment rows and exclude / include checkboxes) was removed; the backend routes
    and the services (`getIdrFlags`, `excludeIdrFlag`, `includeIdrFlag`, `getIdrSegments`, ...) stay. The page still
    reads the flags beside the IDR (`getIdrFlags`) and again after every change it refetches for, for the approval
    dialog and the Construction Reports button; a failure leaves them unknown, silently.
  - **Approving claims them.** "Final Approve & Sign" (`ReviewToolbar`, given `idrFlags`) words its dialog from
    them: "This will claim 18 flags across 4 sites. Total: 420 SF 4\", 180 SF 7\"." (`claimSummary`: the attributed
    flags' square feet by thickness), the pay items they come to as its lines, a count of flags that add no
    quantity, then the usual signing question. Without flags it reads as before. When the backend left out flags
    another IDR claimed first (`flags_dropped` on the IDR `approveStage2` returns), a toast says "IDR approved; 2
    flags already claimed by another IDR were left out."
  - **Un-approving releases them**: the admin's Unlock and Soft-delete (see All IDRs). The review services put the
    response's `flags_claimed` / `flags_dropped` / `flags_released` on the IDR they return.
  - **Hand entry of a flag-filled pay item** (same item number and budget code) is refused by the backend on a
    report save (400); the report page shows that refusal as worded. The picker doesn't hide such items yet.
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
  - `GET /v1/projects/{id}/quantities?from=&to=&cumulative=` (the Progress page: quantities and their budget
    roll-ups; for a user on the project, or an admin)
  - `GET /v1/properties/{id}/construction-report` (a PDF) · `GET /v1/idrs/{id}/construction-reports` (a ZIP): the
    Construction Reports; for anyone on the project
  - `GET /v1/projects/{id}/assessment-summary?from=&to=` (the Sidewalk Assessment Summary tab) ·
    `GET /v1/projects/{id}/assessment-summary/tailored.xlsx?from=&to=&property_id=` (its tailored download) ·
    `GET /v1/projects/{id}/assessment-summary.xlsx` (its accumulative download); anyone on the project
  - `GET /v1/pir-pages/{id}/annotations` (page 1's title block) · `PATCH /v1/pirs/{id}/title-block` (the editor's save;
    members, not demo users)
  - `GET /v1/projects/{id}/progress-rollup?task_order_id=&property_id=` (the Progress page's flag section) ·
    `GET /v1/task-orders/{id}/progress-rollup` (the task order page's Progress); for a user on the project, or an admin
  - `GET /v1/admin/projects` · `POST /v1/admin/projects` (admin only: every project, and creating one) ·
    `PATCH /v1/admin/projects/{id}/assessment-rates` (admin only: body `{cost_per_sf_4in?, cost_per_sf_7in?}`)
  - Properties: `GET /v1/projects/{id}/properties?include_deleted=` (anyone on the project; `include_deleted` is
    admin only) · `POST /v1/projects/{id}/properties` · `GET /v1/properties/{id}` · `PATCH /v1/properties/{id}` ·
    `POST /v1/properties/{id}/admin/soft-delete` · `POST /v1/properties/{id}/admin/undelete` (adding and editing
    for anyone on the project but a demo user, soft-delete and un-delete admin only; body `kind`, `community_board`,
    `notes` and a
    sidewalk's `{boro, block, lot, address, violation_no, property_type}` or a ped ramp's `{boro, intersection_street_1,
    intersection_street_2, quadrant, facing_street, ramp_type}`; a PATCH sends only what changed and never the kind)
  - Task orders: `GET /v1/projects/{id}/task-orders?include_deleted=` · `POST /v1/projects/{id}/task-orders` ·
    `GET /v1/task-orders/{id}` · `PATCH /v1/task-orders/{id}` · `POST /v1/task-orders/{id}/admin/soft-delete` ·
    `POST /v1/task-orders/{id}/admin/undelete` · `POST /v1/task-orders/{id}/properties/{property_id}` (bundle) ·
    `DELETE /v1/task-orders/{id}/properties/{property_id}` (unbundle) (anyone on the project reads, adds, edits,
    bundles and unbundles, a demo user only reads; soft-delete and un-delete are admin only; body `{task_order_number, issued_date, estimate_notes}`, all optional on a PATCH; a list row carries `sidewalk_count` and `ped_ramp_count`)
  - Ped ramps: `GET /v1/projects/{id}/ped-ramp-corners?include_deleted=` · `POST /v1/projects/{id}/pedramp-sites` (a
    corner and a ramp at it, one call; a live corner at the same borough, streets and direction is reused) ·
    `PATCH /v1/ped-ramp-corners/{id}` (a new borough or street carries onto its live ramps) ·
    `DELETE /v1/ped-ramp-corners/{id}` (admin) · `GET /v1/ped-ramp-corners/{id}/inspection-report.pdf` ·
    `GET` / `PUT /v1/properties/{id}/ped-ramp-attributes` (anyone on the project reads; members but demo users write)
  - Ped ramp inspections: `GET /v1/ped-ramp-corners/{id}/inspection` · `POST /v1/ped-ramp-corners/{id}/inspection/start` ·
    `PATCH /v1/ped-ramp-inspections/{id}` (`{requirements_met}`) · `POST /v1/ped-ramp-inspections/{id}/submit` · `/return`
    (`{comment}`) · `/approve` (the corner's and its ramps' writes follow the inspection's lock: 403 submitted, 409 approved)
    · `GET /v1/ped-ramp-inspections/{id}/dot-pdf` (`{url, expires_at, file_name}`) · `GET /v1/ped-ramp-corners/{id}/inspection-report`
  - Ped ramp photos: `GET` / `POST /v1/ped-ramp-inspections/{id}/photos` (with `/upload-request`) · the same under
    `/v1/ped-ramp-tifs/{id}/photos` · `PATCH` / `DELETE /v1/ped-ramp-photos/{id}`
  - Ped ramp listing: `GET /v1/projects/{id}/ped-ramp-inspections` · `POST /v1/projects/{id}/ped-ramp-inspections/bulk-download`
  - `POST /v1/ped-ramp-inspections/{id}/admin/unlock` (admin)
  - Ped ramp TIFs: `GET /v1/ped-ramp-inspections/{id}/tifs` · `POST /v1/ped-ramp-inspections/{id}/ramps/{property_id}/tif`
    · `GET` / `PATCH` / `DELETE` (admin) `/v1/ped-ramp-tifs/{id}` · `POST /v1/ped-ramp-tifs/{id}/approve`
    (`{signer_name, signer_ny_license_no}`) · `GET /v1/ped-ramp-tifs/{id}/dot-pdf`
  - PIRs: `GET /v1/properties/{id}/pir` (the live one) · `GET /v1/properties/{id}/pirs?include_deleted=` ·
    `POST /v1/properties/{id}/pir` · `GET /v1/pirs/{id}` · `PATCH /v1/pirs/{id}` ·
    `POST /v1/pirs/{id}/admin/soft-delete` · `POST /v1/pirs/{id}/admin/undelete` (reading for anyone on the
    project, changes admin only; body `{inspector_initials, inspector_sign_date}`, both optional on a PATCH)
  - PIR pages: `POST /v1/pirs/{id}/image/upload-request` · `POST /v1/pirs/{id}/image/complete` (the file itself is
    PUT straight to the Storage signed URL from upload-request, not to the API) · `GET /v1/pirs/{id}/pages` ·
    `DELETE /v1/pirs/{id}/pages` · `PATCH /v1/pir-pages/{id}/scale` · `PATCH /v1/pir-pages/{id}/rotation` (reading
    for anyone on the project, writes for anyone on it but a demo user; R1d's `GET` / `PATCH` / `DELETE
    /v1/pirs/{id}/image` are deprecated and not called)
  - Flags: `GET /v1/pirs/{id}/flags` (across the PIR's pages) · `POST /v1/pir-pages/{id}/flags` ·
    `GET /v1/flags/{id}` · `PATCH /v1/flags/{id}` · `DELETE /v1/flags/{id}` (a soft delete) (reading for anyone on
    the project; adding, editing and deleting for anyone on it but a demo user). Not called: the deprecated `POST
    /v1/pirs/{id}/flags` and the admin's `/admin/soft-delete` and `/admin/undelete`.
  - Smart PIR drawings: `GET /v1/pirs/{id}/features` · `GET /v1/pirs/{id}/segments` ·
    `GET /v1/flags/{id}/non-assessable-areas` (reading for anyone on the project) · `POST /v1/pirs/{id}/import`
    (anyone on the project but a demo user; the UI's only caller is the admin's import page). Not called yet: their per-page lists, creates, `PATCH` / `DELETE`
    by id, and `GET` / `PUT /v1/pir-pages/{id}/annotations`.
  - Pay items, under `/v1/admin/projects/{id}/pay-items` (admin only): `GET` (list) · `POST` (add) ·
    `PATCH /{pay_item_uuid}` · `DELETE /{pay_item_uuid}` · `DELETE` (clear them all) ·
    `POST /import/preview` · `POST /import/commit` (a CSV as the multipart field `file`)
  - `GET /v1/admin/users` · `POST /v1/admin/users` · `PATCH /v1/admin/users/{user_id}` ·
    `POST /v1/admin/users/{user_id}/password` (admin only: every user, with `?include_deleted=true` for the
    soft-deleted ones too, creating one, changing a user's names, email, admin role and demo flag, and resetting
    a user's password) · `POST /v1/admin/users/{user_id}/delete` (a soft delete) ·
    `POST /v1/admin/users/{user_id}/undelete` · `DELETE /v1/admin/users/{user_id}/permanent` (a soft-deleted
    user with no history only)
  - `POST /v1/users/me/password` (the signed-in user changes their own password)
  - `GET /v1/users/` (the IDR page's banner resolves reporter_uuid → name; the roles page lists who can be given a role; not available to demo users)
  - `POST /v1/idrs/` · `GET /v1/idrs/?project_id=&reporter_uuid=&status=` (plus `include_deleted=` and
    `include_all_drafts=`, admin only; and the archive's `idr_number=`, `work_date=`, `from=`, `to=` and
    repeatable `discipline=`; each row carries `disciplines`) · `GET /v1/idrs/{id}`
  - `PUT /v1/idrs/{id}/header` (the header fields and `task_order_id`) · `POST /v1/idrs/{id}/submit`
  - IDR flags: `GET /v1/idrs/{id}/attributed-flags` · `POST /v1/idrs/{id}/attributed-flags/{flag_id}/exclude` ·
    `POST /v1/idrs/{id}/attributed-flags/{flag_id}/include` (reading for anyone who can read the IDR; changes for
    its inspector on a draft, the stage's reviewer in review, an admin; never a demo user). approve-stage2,
    admin/unlock, admin/delete and admin/undelete add `flags_claimed` / `flags_dropped` / `flags_released`, and the
    same for curb segments (`segments_claimed` / `segments_dropped` / `segments_released`), which the approval toast
    and the admin IDR list's toasts add ("18 flags and 3 curb segments released.").
  - Report sites: `GET` / `POST /v1/idrs/{id}/reports/{report_id}/sites` · `PATCH` / `DELETE .../sites/{site_id}`
    (see Imported sites); a site's pay items `GET` / `POST .../sites/{site_id}/pay-items` · `PATCH` / `DELETE
    .../pay-items/{item_id}`; `GET /v1/idrs/{id}/pay-item-sources?report_id=` (Slice V1).
  - A property's work: `GET /v1/properties/{id}/work-history` (V2) · `GET /v1/properties/{id}/pay-item-summary` (V5);
    `services/propertyWork.js`.
  - IDR curb segments: `GET /v1/idrs/{id}/attributed-segments` · `POST .../attributed-segments/{segment_id}/exclude`
    · `POST .../attributed-segments/{segment_id}/include` (who: as for flags).
  - Review: `GET /v1/idrs/queue?status=` · `POST /v1/idrs/{id}/accept-stage1` · `POST /v1/idrs/{id}/approve-stage1` ·
    `POST /v1/idrs/{id}/accept-stage2` · `POST /v1/idrs/{id}/approve-stage2` · `POST /v1/idrs/{id}/return`
  - Reviewer edits: `PATCH /v1/idrs/{id}/field` · `POST /v1/idrs/{id}/pay-items/{item id}/revise` ·
    `POST /v1/idrs/{id}/pay-items/add` ·
    `POST /v1/idrs/{id}/pay-items/{item id}/approve` ·
    `POST /v1/idrs/{id}/reports/{report_id}/trucks/add` (each returns the IDR with `field_edits`, as `GET /v1/idrs/{id}` does)
  - Admin: `POST /v1/idrs/{id}/admin/unlock` · `POST /v1/idrs/{id}/admin/delete` (a soft delete) ·
    `POST /v1/idrs/{id}/admin/undelete` · `DELETE /v1/idrs/{id}/admin/permanent` (a soft-deleted IDR only)
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
