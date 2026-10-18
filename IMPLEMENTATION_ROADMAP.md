# Sabor con Amor — Implementation Roadmap

Each phase needs explicit approval before it starts. "Done" means the acceptance checks were actually run and passed.

| Phase | Status |
|---|---|
| 0. Reference audit & media | Done (`SABOR_PHASE_0_AUDIT.md`, `media/MEDIA_INVENTORY.md`) |
| 1. Foundation | **Done** — see "Phase 1 record" below |
| 2. Content de-branding & neutral configuration | **Done** — see "Phase 2 record" below |
| 3. Customer authentication & customer panel | **Done (UI + verified logic); live use blocked on a Firebase project** — see "Phase 3 record" |
| 4. Admin login & dashboard | **Done (UI + verified authorization); live use blocked on a Firebase project** — see "Phase 4 record" |
| 5. Integrate & verify existing business functionality | **Done (logic + Firestore emulator verified); live use blocked on a Firebase project** — see "Phase 5 record" |
| 6. Final QA, security & release readiness | **Done** — see "Phase 6 record". Not production-ready until the Firebase project and business inputs exist |
| 7+ | Not started |

## Phase 1 record (foundation)

- Copied reference source and config only. Excluded: `.env.local`, the Firebase Admin key JSON, `.vercel`, logs, reports, screenshots, scanned PDF, `public/` media, `node_modules`, `.next`, `.git`.
- New git repository (`main`, no commits yet). Dependencies installed with `npm ci` from the unchanged lockfile; none added.
- **Renamed:**
  - package `sadiq-pearl-marquee` → `sabor-con-amor`
  - env `SADIQ_PEARL_ADMIN_MFA_REQUIRED` → `SABOR_ADMIN_MFA_REQUIRED`, `SADIQ_PEARL_APPCHECK_ENFORCE` → `SABOR_APPCHECK_ENFORCE`, `SADIQ_PEARL_E2E_MEMORY_STORE` → `SABOR_E2E_MEMORY_STORE`, `SADIQ_PEARL_E2E_SEED` → `SABOR_E2E_SEED`
  - emulator project `demo-sadiq-pearl` → `demo-sabor-con-amor`
  - process-local cache keys `__sadiqPearl*` → `__saborConAmor*`
  - Admin SDK app name `sabor-con-amor-admin`
  - default security-log salt `sabor-con-amor-security-log`
  - PDF producer label; WhatsApp default message
  - password blocklist entries (`saborconamor`, `sabor`)
  - file-header comments (rules, tailwind)
  - `.env.example` header
  - CI and Dependabot paths (app now at repo root)
- **Business identity:** `name` / `shortName` "Sabor con Amor" (signage); `tagline` "Taste with love" (roadside sign, **wording to confirm**); domain fallback `https://sabor-con-amor.invalid`; root page metadata limited to the signage facts.
- **Not renamed (deliberately):** Firestore collection names, API routes and payloads, data models. None contains the brand.
- Design references rebranded (see `DESIGN_MAPPING.md` §1).

## Phase 2 record (content de-branding)

**Code (`src/`)**
- `src/lib/config.ts`: the reference venue's phones, WhatsApp number, address, Google rating and count, Maps link and TikTok account were removed. These fields are now `null` or empty, and every consumer hides them: `whatsapp.ts`, `Navbar`, `Footer`, `Location`, `QuickActions`, `FinalCta`, `/book`, `NotConfigured`, `PortalStates`, SEO structured data, admin settings, PDF header. `venueFeatures` is empty. There is no logo (`media.logo = null`). `media` points at approved files copied from `media/04_website_ready` into `public/images/`.
- `src/data/*`: menus, menu-card scans and PDF, event categories, highlights, Google reviews (real reviewer names), and the policy card are all emptied. The gallery was rebuilt from 21 approved Sabor con Amor images, with captions limited to what each image shows. There are no reels (no approved clip yet).
- `DEFAULT_CONFIG`: the reference guest surcharge (300 guests / Rs 300) and 5% service charge were removed. Menus are empty. The hall display name is "Banquet Hall" (from signage). Capacity, Day/Night slots, hold, horizon and event types are kept only because the booking engine and tests use their IDs, and are marked **INHERITED, not Sabor con Amor facts**.
- Component and page copy: every "Sadiq Pearl / Marquee", Kakrot / Sarai Alamgir location, "free parking", "table service", "in-house catering", Day/Night marketing line and printed-card reference was removed or replaced with `business.name` and the three signage services. Sections whose data is empty (Events, DecorReels, Amenities, Google Reviews) render nothing. Menus and Terms show a neutral "will be published once confirmed" note.
- `grep -ri "sadiq|pearl|sarai|alamgir|kakrot|rashidpur|orangabad"` over `src/` returns nothing.

**Media published under `public/images/`** (21 files): only approved frames and photos. Not published:
- the "do not publish" frame;
- frames with identifiable staff or guests (consent needed);
- frames with readable number plates;
- both roadside-sign frames (they show an unconfirmed phone number).

**Tests**
- Four suites (admin edit, config validation, immutability, request validation) borrowed the reference menus as fixtures. They now use neutral fixtures (`FIXTURE_MENUS`, `MENU_FIXTURE_CONFIG` in `tests/booking/test-config.ts`) and assert the same behaviour.
- `menu-images.test.ts`: its Sadiq-Pearl-specific assertions are obsolete. It now guards that every declared menu image exists at its declared size and is matched only by its own id and title. No menus are declared yet, so these loops currently have no entries.
- `policies.test.ts`: the assertions on the card's wording and default values are obsolete and were replaced by "defaults invent no pricing rules". The surcharge and service-charge engine tests and the quotation-terms test are kept, using labelled fixture values.

**Design references (`design/stitch/*/code.html`)**
- Fabricated business content was neutralized and the layout kept: placeholder text "To be confirmed", "Name placeholder", "Price to be confirmed" and similar.
- Generator / power monitoring and stage CAD / blueprint blocks were removed, along with their script.
- All 86 stock images were replaced with approved Sabor con Amor media. Logos and avatars became neutral placeholders.
- Developer comments were removed. Fake `tel:` links now point to `#`.
- See `DESIGN_MAPPING.md` §1 for what remains.

## Phase 3 record (customer authentication & customer panel)

**Provider and data (confirmed from the code):** Firebase Authentication (email/password with verification and reset, Google sign-in) with server session cookies verified by the Firebase Admin SDK, and Cloud Firestore. **Neither is configured**: there is no Sabor con Amor Firebase project and no `.env.local`. Without them, the sign-in pages show an honest "online accounts aren't available yet" panel and `/account/*` redirects to sign-in. Nothing is simulated or mocked.

**Implemented (restyled to the Stitch design system; logic reused unchanged):**
- **Sign up, login, Google sign-in, password recovery, email-action handler.** Stitch split card: Imperial Emerald panel listing only real account features, plus the form panel.
- **Customer dashboard.** Welcome header; next event; booking summary cards from real counts; quick actions; account status.
- **My bookings.** Status filter pills; booking cards with status badges in the DESIGN.md palette. Also fixed the invisible count on the active filter.
- **Booking details (dossier layout).** Event, status timeline, change / cancellation requests and review on the left. Pricing, quotations and receipts, venue terms and help on the right.
- **Profile / settings.** Personal details, sign-in email, sign-in method, account deletion.
- **Notifications.** Restyled header only.

The design's placeholder-only modules were not built: planning progress, CAD / stage blueprints, assigned concierge, tasting schedules, "remember this workstation", demo auto-fill.

**Design system scope:** the new `imperial` / `brass` / `status` colours and the `.theme-sabor` scope (globals.css) are applied only to the auth and `/account` layouts. Playfair Display is loaded via `next/font`. The public site and admin still use the reference tokens until their phases.

**Security (server-side):**
- Every `/account` page calls `requireUser()`.
- Every `/api/account/*` route verifies the session (`getSessionUser` / `verifySession`), with origin and rate checks inherited.
- Portal loaders query only the session's `uid`; another customer's booking is indistinguishable from a missing one.
- New `tests/booking/customer-isolation.test.ts` (5 tests) proves B cannot read or list A's bookings, request changes on them, review them, mark A's notifications read, or read or overwrite A's profile.
- Existing suites already cover receipts and quotations, reviews, notifications and account deletion ownership.

**Not runtime-verified (needs a Firebase project or the Auth emulator):**
- the full sign-in round trip, Google popup and password-reset email;
- the `/account` pages with a real session;
- the Firestore-adapter and security-rules suites.

**Visual QA (Phase 3A, local only):** done at 1280 px and 390 px (device emulation via headless Edge), using emulator-only demo settings with no auth backend.
- **Checked:** sign up, login and password recovery render per the design with no horizontal overflow, and show clear validation messages.
- **Google:** the button renders; a click without a backend fails visibly with an error notice.
- **Protected routes:** all `/account` routes redirect signed-out visitors to `/login?next=…`.
- **Fixed:** a duplicate panel chip, and the header services line wrapping on narrow phones.
- **Blocked:** the signed-in dashboard, My bookings, Booking details and Profile pages, because they need a real session (Firebase project or Auth emulator).

**Setup steps to make it live:**
1. Create a Sabor con Amor Firebase project. Enable Email/Password and Google providers, and add the site domain to the authorized domains.
2. Fill `.env.local` from `.env.example` (variable names listed in `ARCHITECTURE.md` §8).
3. Set the Firebase email action URL to `https://<domain>/auth/action`.
4. Deploy `firestore.rules` and `firestore.indexes.json`.
5. Run `npm run test:rules` and `npm run test:booking:firestore` (needs firebase-tools 15.31.0 and Java 21).

## Phase 3B record (API 404 investigation & QA cleanup)

**API 404s from Phase 3A: not a project-code or configuration fault.**
- All 39 route files exist with the correct exported methods.
- The proxy matcher excludes `/api/`, and there is no `basePath`, rewrites or redirects.
- On a fresh `npm run dev`, on `next start` (production) and on the preview-tool server, all 16 probed endpoints reach their handlers and return correct JSON: 200, 401, 405, or 503 for "unavailable, not configured". There are no 404s.
- The failing Phase 3A server (an earlier `web` instance, process gone) returned Next's HTML not-found page even for `GET /api/auth/session`. That handler can only return JSON, so the server was not routing to it, while it did route `/api/account` and `/api/availability`.
- Its internal state can't be inspected now. Two servers sharing the folder was ruled out: Next 16 refuses a second `next dev` in the same directory.
- No code change was made for this.

**QA tooling:** the Mr Foodie launches came from the preview tool using the session's original folder config.
- `.claude/launch.json` now uses unique names (`sabor-web`, `sabor-web-emulator-demo`), an explicit `cwd`, dedicated ports (3010 / 3110) and `autoPort: false`.
- `sabor-web` was verified to start Sabor con Amor; Mr Foodie was not modified.

**Favicon:** none exists (`public/favicon.ico` and `app/icon` are both missing), while `layout.tsx` metadata points at `/favicon.ico`, so browsers get a 404. **Missing asset** (see open decision 18); no logo was invented.

**Small fix:** `AuthFrame.tsx` hall photo marked `loading="eager"`, as Next's LCP warning requested. The warning no longer appears.

**Authentication checks**

| Check | Locally verifiable now? |
|---|---|
| Unauthenticated `/account/*` redirects to `/login?next=…` | Yes, verified |
| Account / document / admin APIs refuse signed-out callers (401) or report not configured (503) | Yes, verified (see probe results) |
| Form validation and visible error states; Google button failure notice | Yes, verified |
| Cross-customer isolation of bookings, requests, reviews, notifications and profile | Yes, by unit tests (`customer-isolation.test.ts`, 5/5) against the in-memory store |
| Real sign-up / sign-in / Google popup / reset email / session cookie | **No.** Needs a Sabor con Amor Firebase project, or the Firebase Auth emulator (firebase-tools) |
| Signed-in dashboard, bookings, details, profile pages | **No.** Needs a real session |
| Firestore adapter + security rules (`test:booking:firestore`, `test:rules`) | **No.** Needs firebase-tools 15.31.0 + Java 21 (emulators) |

## Phase 4 record (admin login & dashboard)

**Admin login (`/admin/login`).** Restyled to the Stitch gateway. It keeps the existing secure flow:
- email and password only, with a password visibility toggle, validation, and loading and error states;
- MFA support;
- no Google option and no sign-up.

Added "Forgot password?", which uses Firebase's email reset link (works for admin accounts). Sign-out (`SignOutButton`) is in the sidebar and in the mobile header.

**Admin shell.** Stitch sidebar (grouped navigation, emerald active state, admin email, view site, sign out), collapsing to a scrolling top bar on small screens. It uses the design-system scope (`theme-sabor`, plus the existing `admin-ui` readability scope).

**Sections**

| Section | Route | Implementation |
|---|---|---|
| Overview dashboard | `/admin` | Existing, restyled. Counts, today's slots, the pending queue and finance sums come only from real records |
| Booking management | `/admin/bookings`, `/new`, `/[id]` | Existing: status transitions, edit, archive / delete with confirmations, manual bookings |
| Customer management | `/admin/customers`, `/[uid]` | Existing CRM and notes |
| Menus & packages | `/admin/menus` **(new page)** | Reuses the menus / packages / services editors and the audited, versioned settings API; moved out of Settings |
| Gallery | `/admin/gallery` **(new page, read-only)** | Lists the published approved photos. **Uploads are blocked:** Firebase Storage is disabled (`storage.rules` deny all) pending decision 8 |
| Availability & calendar | `/admin/calendar` | Existing month / range views and date / slot locks |
| Quotations & payments | `/admin/finance` **(new page, read-only)** | Per-booking price, recorded payments, remaining and payment status, from stored prices and recorded payments only. Recording, voiding and quotations stay on the booking page (existing confirmed, audited actions) |
| Website content & business settings | `/admin/content` **(new, read-only)**, `/admin/settings` | Content: shows what the site displays and where it comes from; **browser editing not available** (decision 9). Settings: existing halls, slots, rules, event types, pricing, policies, history |
| More | `/admin/events`, `/vendors`, `/communications`, `/reviews`, `/reports` | Existing tools, kept |

**Security fix.** The 14 admin pages relied on the layout's `requireSuperAdmin()`. Next.js 16 documents that a layout "does not control whether the rest of the route renders", so every admin page now calls `requireSuperAdmin()` itself. The admin data layer (`admin-server.ts` `run()`) already verified the session before any query.

New `tests/booking/route-guards.test.ts` (5 tests) fails if:
- any admin page lacks its own guard;
- any `/api/admin` route doesn't authorize through `adminMutation` / `requireSuperAdminApi`;
- any `/api/account` route doesn't verify the session;
- an admin sign-up route appears.

**Runtime checks (local, signed out):**
- All 17 admin pages return 307 to `/admin/login?next=…`.
- A page-segment-only (RSC) request for `/admin/finance` is also redirected and leaks nothing.
- Admin APIs return 401 for same-origin calls and 403 for cross-site calls.
- Admin login renders at 1280 and 390 px with no overflow, and validates empty fields.

**Not runtime-verified (needs a Firebase project or the Auth emulator):**
- the signed-in dashboard pages and their responsive layout;
- a non-admin signed-in user getting 404 (server code path present, not exercised);
- settings persistence, payment recording and other writes against a real store.

These paths are covered by the existing unit suites (admin, config, finance, immutability, blocks, customers).

## Phase 5 record (integration & verification)

**Verification layers used**
- **U:** unit suites, in-memory store (`npm run test:booking`, 268/268).
- **X:** new cross-surface integration test (`tests/booking/cross-surface.test.ts`): one booking through public availability → customer portal → admin list → confirm → payment → void, re-reading after each step, on one shared store.
- **F:** real Firestore adapter on the Firestore emulator (`test:booking:firestore`, **41/41**, first run in this project).
- **R:** Firestore + Storage security rules on the emulators (`test:rules`, **97/97**, first run in this project).
- **H:** HTTP checks against a running server, signed out (Phases 3B/4/5).
- **None of these used a real Firebase project or real accounts.**

**Running F and R on this machine**
- Requirements: JDK 25 (Java 21+) and firebase-tools 15.31.0.
- The JDK's Unix-socket pipe fails in the user temp folder (`Selector.open` → "Invalid argument: connect", reproduced with a minimal Java program). Set `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\Windows\Temp` and put the JDK 25 `bin` first on `PATH`.
- Then run the `package.json` commands (`firebase` via `npx firebase-tools@15.31.0`).

**Functionality matrix**

| Reference feature | New implementation | Reused / adapted | Verified by | Result | Remaining limitation |
|---|---|---|---|---|---|
| Public availability calendar | `/book` → `AvailabilityCalendar`, `GET /api/availability` | Reused engine (`getAvailability`) | U, X, F (availability), H (503 when no DB) | Pass | No live DB: shows "unavailable", never invented dates |
| Booking request (enquiry) | `/book` → `BookingRequestFlow` → `POST /api/bookings` (sign-in required) | Reused; copy de-branded | U, X, F (double-booking, duplicate submission, ownership) | Pass | Open (signed-out) enquiry form not built: decision 4 |
| Double-booking prevention | Slot locks per date × hall × slot | Reused | U, X (clash refused), F (concurrency) | Pass | Slot model inherited (Day/Night): decision 3 |
| Customer bookings list / details | `/account/bookings`, `/[id]` | Reused portal loaders, restyled | U, X, `customer-isolation` (5), F (ownership) | Pass | Signed-in UI not opened (no Firebase session) |
| Change / cancellation requests | Booking details → `ChangeRequests` | Reused | U, F | Pass | — |
| Reviews (customer + moderation) | Booking details, `/reviews`, `/admin/reviews` | Reused | U, F, R | Pass | — |
| Notifications | `/account/notifications` | Reused | U, F, R, isolation | Pass | In-app only (no email/SMS) |
| Profile / account deletion | `/account/profile` | Reused | U (deletion), F (deletion), isolation | Pass | — |
| Sign up / login / Google / reset | `(auth)` pages | Reused Firebase Auth flows, restyled | H (rendering, validation, failure notice), R | Partly | Live sign-in needs a Firebase project |
| Admin login + MFA | `/admin/login` | Reused, restyled, + forgot password | H, route-guard test | Pass (signed-out) | Live admin sign-in needs a Firebase project |
| Admin authorization | Layout + every page `requireSuperAdmin`, APIs `adminMutation` | Reused + Phase 4 page guards | route-guards (5), H (17 pages 307, APIs 401/403, RSC request redirected), R | Pass | Non-admin signed-in 404 path not exercised live |
| Admin booking management (status, edit, archive, delete) | `/admin/bookings*` | Reused | U (admin, edit, archive), X (confirm), F (admin concurrency, statuses) | Pass | — |
| Manual / offline bookings | `/admin/bookings/new` | Reused | U, F | Pass | — |
| Customer CRM | `/admin/customers*` | Reused | U (admin-customers), R (notes private) | Pass | — |
| Availability locks (block / unblock) | `/admin/calendar` | Reused | U (admin-blocks), F (admin improvements) | Pass | — |
| Menus / packages / services | `/admin/menus` (moved from settings) | Reused editors + settings API | U (config validation, fixtures), F (pricing snapshot) | Pass | No confirmed menus or prices: decision 5 |
| Pricing / quotations | Booking detail `FinancePanel`; `/admin/finance` overview | Reused; new read-only overview | U (finance, policies), F (payments, quotations, immutability) | Pass | No confirmed prices: "pricing pending" |
| Payments record / void / receipts | Booking detail `FinancePanel` | Reused (verified, audited actions only) | U, X (record + void consistent everywhere), F | Pass | — |
| Business settings | `/admin/settings` | Reused | U (config), F | Pass | Inherited defaults to confirm: decisions 2, 3, 16 |
| Gallery | Public `/gallery`; `/admin/gallery` read-only | Data replaced with approved media | H (renders), R (storage denies all) | Pass (read-only) | Uploads need storage: decision 8 |
| Website content | `/admin/content` read-only | New status page | Typecheck / build | Pass (read-only) | Browser editing: decision 9 |
| Event operations / vendors | `/admin/events`, `/admin/vendors` | Reused | U (operations), F (event operations) | Pass | Kept under "More": decision 10 |
| Communications (WhatsApp log) | `/admin/communications` | Reused | U, R | Pass | WhatsApp number not configured: links hidden |
| Reports / dashboard stats | `/admin`, `/admin/reports` | Reused | U (admin-stats, alerts) | Pass | Real records only |
| Venue terms / policies | Terms sheet, quotations | Data emptied (Sabor terms unconfirmed) | U (policies, fixtures) | Pass | Decision 7 |

**Integration fix in Phase 5:** the home-page navigation and footer linked to Stages & Décor, Events and Reviews even though those sections render nothing while their data is empty. That was an accidental Phase 2 behaviour change, and these were dead anchors. `navLinks` now lists a section only when it renders, verified on the running home page: every anchor resolves.

**Duplicates / regressions checked:**
- no links remain to the removed settings tabs;
- the booking form hides the menu field while no menus exist;
- the sitemap lists only existing pages.

**Not verified end to end:** sign-in through a real browser session, and persistence "after a new authenticated session". These need a Sabor con Amor Firebase project, or the Auth emulator with test accounts. **Owner decision (2026-10-17): no emulator test accounts.** End-to-end browser testing waits for the real Sabor con Amor Firebase project. F covers persistence at the database layer; X covers the same flow at the logic layer.

## Phase 6 record (final QA, security & release readiness)

**Automated results (2026-10-17)**

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | 0 errors, 0 warnings (fixed `postcss.config.mjs` anonymous export) |
| Unit + integration | `npm run test:booking` | 268 / 268 |
| Security rules (emulators) | `npm run test:rules` (via `npx firebase-tools@15.31.0`, JDK 25) | 97 / 97 |
| Firestore adapter (emulator) | `npm run test:booking:firestore` (same) | 41 / 41 |
| Production build | `npm run build` | Success (warning: `NEXT_PUBLIC_SITE_URL` not set) |
| Accessibility | axe-core 4.10.3, WCAG 2.1 A/AA, desktop / tablet / mobile | 0 violations on `/`, `/gallery`, `/reviews`, `/book`, `/login`, `/signup`, `/forgot-password`, `/admin/login`, 404, after one fix |
| Keyboard | Tab walk on `/login`, `/admin/login` | Logical order; every stop named, with a visible focus ring |
| Branding | Source, `public/`, 9 rendered pages | No Sadiq Pearl / Pak Marquee / old-location text |
| Dependencies | `npm audit` | 16 findings (12 high, 4 moderate; 7 in runtime deps), all transitive. High fixes need major version changes: **not applied (approval needed)** |

**Fixes in Phase 6**
1. `VenueShowcase` swipe row: not keyboard-scrollable (axe "scrollable-region-focusable", WCAG 2.1.1). Now focusable.
2. Lint warning in `postcss.config.mjs`.

The earlier axe contrast failures on the home page were text captured mid fade-in animation; with reduced motion (final rendering) there are none.

**Security review**
- **Authorization:** every admin page and the admin layout call `requireSuperAdmin`. Admin APIs use `adminMutation` (same-origin, session, super_admin claim, MFA when required, recent sign-in for sensitive actions). Account APIs verify the session. Enforced by `route-guards.test.ts`.
- **Customer isolation:** `customer-isolation.test.ts`, plus the Firestore ownership suites and rules.
- **Input validation:** ID patterns, unknown-field rejection and domain validators on every write route; malformed JSON is rejected.
- **Booking integrity:** slot locks, idempotent request keys and double-booking protection, verified under concurrency on Firestore.
- **Payment integrity:** amounts only via the audited record/void actions; voids kept, never deleted; historical immutability verified.
- **Uploads:** none exist; Storage rules deny all.
- **Secrets:** none in the repo; `.env*`, key files and `.vercel` are git-ignored. Browser variables are only the public Firebase web config and flags.
- **Errors:** APIs return codes, not stack traces; the 404 page is clean.
- **Headers:** nonce CSP with `strict-dynamic`, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, HSTS (production); no X-Powered-By; APIs `no-store`.
- **Session cookie:** httpOnly, sameSite=lax, secure in production.

**Release blockers (manual setup, owner)**
1. Create the Sabor con Amor Firebase project:
   - enable Email/Password and Google;
   - authorized domains;
   - email action URL `/auth/action`;
   - Identity Platform + TOTP if admin MFA is wanted.
2. Fill `.env.local` / hosting secrets (names in `.env.example`) and set `NEXT_PUBLIC_SITE_URL`.
3. Deploy `firestore.rules`, `firestore.indexes.json` and `storage.rules`. No data migration: the project starts empty.
4. Create the first admin with `scripts/set-super-admin.mjs`.
5. Choose and configure hosting. There is no deployment config in the repo; the reference used Vercel.
6. Business inputs: open decisions 1–18 (contacts, menus, prices, policies, halls / slots, event types, time zone, logo / favicon, media).
7. Decide on the dependency upgrades from `npm audit`.
8. After 1–4, run the signed-in browser tests that were deferred (owner decision: no emulator test accounts).

## Still inherited from the reference (decide before launch)

| Item | Where | Why kept |
|---|---|---|
| Hall capacity 1,000; Day/Night slots; 48 h hold; 730-day horizon; event types (wedding, nikkah, mehndi, barat, walima, …) | `DEFAULT_CONFIG` | Booking engine and tests key on these IDs; changing them is booking work. Super Admin can change them, or they can be confirmed here |
| Business time zone `Asia/Karachi` | `src/lib/booking/dates.ts` | Core date logic; the location is not confirmed |
| Currency `PKR`, locale `en_PK` | business config, SEO | Data-model type; to confirm |
| Admin "Day / Night" labels | admin calendar, settings, reports, `BlockedSlots` | Follow the inherited slot model |
| Event-type labels in design screens (Barat, Walima, Mehndi, Nikkah) | `design/stitch/*` | Design placeholders; real categories are open decision 15 |
| `tailwind.config.ts` "Noir + champagne gold" tokens, Cormorant Garamond | styling | Replaced in the design-system phase |

## Open decisions (not answered on your behalf)

1. **Restaurant and Rooftop BBQ scope:** information only, or table reservations or ordering? Neither exists in the code.
2. **Halls:** how many, their names and capacities, and whether customers choose a hall (the current public flow books one default hall).
3. **Booking slots:** names and start/end times; hold hours; booking horizon; minimum guests.
4. **Enquiry access:** open enquiry form (as the design shows) or sign-in-gated booking (as the reference does).
5. **Prices:** menus, packages, services, hall rent, per-guest rates.
6. **Contact facts:** phones, WhatsApp, email, address, map link, social accounts, opening and visiting hours.
7. **Policies and terms:** advance, cancellation, refunds.
8. **Admin gallery:** whether admins upload media (needs Firebase Storage or another store; currently disabled).
9. **Website content editing:** whether admins edit page text (no such feature exists).
10. **Undesigned reference features:** keep, hide or drop `/reviews`, `/admin/events`, `/admin/vendors`, `/admin/reviews`, `/admin/reports`, `/admin/communications`.
11. **Tagline:** confirm "Taste with love".
12. **Domain, Firebase project and hosting** for Sabor con Amor.
13. **Design-only modules** (generator/power telemetry, stage CAD layouts, staff roster, tastings): excluded unless real requirements and data are supplied.
14. **Consent** for publishing frames that show staff.
15. **Event categories** Sabor con Amor offers (the defaults and the design's Barat / Walima / Mehndi / Nikkah are unverified).
16. **Location / time zone / currency** (inherited `Asia/Karachi`, PKR, `en_PK`).
17. **Hero and reel video:** approve cutting the recommended drone segment (tour video 33.5–37.9 s) into a clip, and any décor reels.
18. **Logo files and favicon** (none supplied; the site shows the name in text; `/favicon.ico` currently 404s).

## Dependencies and known blockers

- **No Sabor con Amor Firebase project yet.** Auth, Firestore and every runtime flow are blocked until one exists (you create it; credentials go only into a local `.env.local`).
- **Emulator test tooling:** works locally since Phase 5 with JDK 25 + `npx firebase-tools@15.31.0` and the `JAVA_TOOL_OPTIONS` workaround (see Phase 5 record).
- **Missing media:** original high-resolution and landscape footage, the restaurant, the rooftop, plated food, logo files and favicon (see `media/MEDIA_INVENTORY.md` §5). There is no favicon or logo in the project now.
- **The home directory `C:\Users\sheharyar` is itself a git repository.** This project has its own nested repo, so its files are not committed there, but the outer repo will show this folder as untracked.
- The project lives in OneDrive, so `node_modules` (~700 MB) and `.next` get synced. Consider excluding them from OneDrive sync (your setting; not changed).

## Next phases (outline; each needs approval)

3. Design-system foundation (DESIGN.md tokens, Playfair Display + Plus Jakarta Sans, primitives) · 4. Public website · 5. Auth screens · 6. Customer panel · 7. Admin area (incl. decisions 8–10) · 8. Firebase project, rules deployment, emulator suites, MFA, App Check · 9. Content entry and launch.
