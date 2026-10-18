# Sabor con Amor — Phase 0: Reference Audit & Implementation Plan

Date: 2026-10-15 · Status: **audit only, nothing implemented** · Awaiting approval before Phase 1.

## 0. What was supplied and where it was inspected

| Input | Identified as | Notes |
|---|---|---|
| `Sadiq-Pearls-marquee (2).zip` (347 MB, 47,621 entries) | Reference app at `Sadiq-Pearls-marquee/sadiq-pearl-marquee-website/sadiq-pearl-marquee/` | Also holds screenshot folders (`admin-improvements-screenshots/`, `menu-*-screenshots/`, `live-admin-check/`), a `luxury-concept/compare.html`, logs, and **`node_modules` (702 MB)** |
| `stitch_pak_marquee_ui_ux_system.zip` | Approved design: 17 screens (`code.html` + `screen.png`) + `pak_marquee_narrative_system/DESIGN.md` | Branded **"Pak Marquee"** with placeholder content (see §6) |
| `WhatsApp Unknown 2026-10-15 at 23.04.10.zip` | Sabor con Amor media: 10 images + 2 videos | Audited in `media/MEDIA_INVENTORY.md` |

Everything was extracted to session scratch folders. Nothing in `Downloads` was changed, and the Mr Foodie repo (this session's working folder) was not touched. The Sabor con Amor working directory is `C:\Users\sheharyar\OneDrive\Desktop\Sabor con Amor` (created 2026-10-16). It holds this audit (folder root) and the organized media (`media/`); no application code yet.

## 1. Reference architecture summary (checked against the code)

- **Framework:** Next.js `^16.3.8` App Router, React `^19.3.0`, TypeScript 5, Tailwind CSS 3.4, ESLint 9 (`eslint-config-next`). Node `>=20.9.0` (CI uses Node 24). `AGENTS.md` warns that this Next.js version changes some APIs; read `node_modules/next/dist/docs/` before writing code.
- **Backend:** Next.js route handlers in `src/app/api/**` (34 POST, 4 GET, 2 DELETE, 1 PATCH). They use the Firebase Admin SDK (`src/lib/firebase/admin.ts`). No separate server.
- **Database:** Cloud Firestore behind a storage abstraction: `src/lib/booking/store.ts` with `firestore-store.ts` for production and `testing/memory-store.ts` for tests. Collections: `users, bookings, bookingRequests, slotLocks, counters, businessConfig, payments, quotations, reviews, notifications, communications, customerNotes, eventOperations, vendors, vendorAssignments, adminAudit, adminState`. Rules are in `firestore.rules`, indexes in `firestore.indexes.json`.
- **Auth:** Firebase Auth with email/password, Google sign-in, email verification and password reset. Server sessions use `createSessionCookie` (`src/lib/auth/server.ts`, `api/auth/session`). Roles are `customer`, `admin` and `super_admin`, and `scripts/set-super-admin.mjs` bootstraps the first super admin. Optional TOTP MFA for admins is controlled by a feature switch.
- **Storage:** Firebase Storage is **not used**. `storage.rules` denies all access, and every media file is static under `public/`.
- **Security layer:** `src/proxy.ts` adds a nonce-based CSP per request (`lib/security/csp.ts`). Headers are set in `next.config.mjs`. The app also has an in-memory rate limiter (`lib/security/limits.ts`, `lib/booking/rate-limit.ts`), a hashed security log (`lib/security/log.ts`) and optional App Check.
- **Documents:** `pdf-lib` generates quotation and receipt PDFs (`lib/booking/documents-pdf.ts`, `api/documents/*`).
- **External integrations:** WhatsApp works through **`wa.me` deep links only**, not the WhatsApp API (`lib/whatsapp.ts`; the admin composer logs messages). The app also links to Google Maps and TikTok. Notifications are **in-app only**: Firestore `notifications`, with no email or SMS provider. Deployment is on Vercel (`.vercel/project.json`).
- **Configuration model:** `src/lib/config.ts` holds the business identity. `src/lib/config/business-config.ts` defines the venue setup: halls, Day/Night slots, booking rules, event types, services, menus, packages and pricing. It is stored as one versioned Firestore document and edited by the Super Admin. Prices start as "not configured", so nothing is invented.

### Routes
- **Public `(site)`:** `/` (home page made of section components), `/book`, `/gallery`, `/reviews`, plus `robots.ts` and `sitemap.ts`.
- **Auth `(auth)`:** `/login`, `/signup`, `/forgot-password`, `/auth/action` (email action handler).
- **Customer `(account)`:** `/account`, `/account/bookings`, `/account/bookings/[bookingId]`, `/account/notifications`, `/account/profile`.
- **Admin:** `/admin/login`; `/admin` (dashboard), `/admin/bookings` (+`/new`, `/[bookingId]`), `/admin/calendar`, `/admin/customers` (+`/[uid]`), `/admin/events` (+`/[bookingId]`), `/admin/communications`, `/admin/reports`, `/admin/reviews`, `/admin/settings`, `/admin/vendors` (+`/[vendorId]`).
- **API:** `availability`, `bookings`, `auth/session`, `account/*` (profile, sync, deletion, notifications, change requests, reviews), `admin/*` (bookings status, price, edit, notes, payments, quotations, archive and delete; slots block and unblock; customers; events checklist, status, notes and vendors; vendors; reviews; settings; alerts; WhatsApp log), and `documents/*` (PDFs).

## 2. Verified functionality inventory

**Evidence I collected in this audit.** I ran these in a scratch copy using the `node_modules` bundled in the ZIP (Node 24.18.1):

| Command | Result |
|---|---|
| `npm run typecheck` | **Pass** (no errors) |
| `npm run lint` | **Pass**: 0 errors, 1 warning (`postcss.config.mjs` anonymous default export) |
| `npm run test:booking` | **257 / 257 pass**, 74 suites, 0 failed or skipped |
| `npm run build` | **Not run** |
| `npm run test:rules`, `npm run test:booking:firestore` | **Not run**: no `firebase` CLI on this machine, and the Firestore emulator needs Java 21 (Java 17 is installed). The reference's own `SADIQ_PEARL_VERIFICATION_REPORT.md` also lists these as not executed. |
| Dev server, browser and E2E testing | **Not run** in this audit |

"Unit-tested" below means the logic passes `tests/booking/*.test.ts` against the in-memory store. It does **not** prove the Firestore adapter, the security rules or the UI work at runtime.

| Capability | Implementation | Evidence level |
|---|---|---|
| Availability per date × slot, slot locks, pending hold expiry | `lib/booking/availability.ts`, `engine.ts`, `slotLocks` | Unit-tested (`engine.test.ts`) |
| Customer booking request (sign-in required) | `/book`, `BookingRequestFlow`, `api/bookings` | Engine unit-tested; UI not run |
| Admin accept / reject / status transitions, manual (offline) booking | `admin.ts`, `status.ts`, `api/admin/bookings/*` | Unit-tested (`admin.test.ts`) |
| Admin edit, archive, delete, immutability of records | `admin-edit.ts`, `admin-archive.ts` | Unit-tested |
| Blocked dates / slots | `admin-blocks.ts`, `api/admin/slots/*` | Unit-tested |
| Pricing breakdown, quotations, payments, void, receipts, PDFs | `pricing.ts`, `finance*.ts`, `documents-pdf.ts` | Finance unit-tested; PDF output not checked |
| Customer portal: bookings, change requests, reviews, notifications, profile, account deletion | `portal*.ts`, `lib/account/*` | Unit-tested (`portal`, `reviews`, `notifications`, deletion) |
| Customer CRM, customer notes | `admin-customers.ts`, `customer-notes-model.ts` | Unit-tested |
| Event operations: checklist, vendor assignments, vendors | `operations*.ts` | Unit-tested |
| Dashboard stats, alerts, reports | `admin-stats.ts`, `admin-alerts.ts` | Unit-tested |
| Business settings (halls, slots, event types, services, menus, packages, prices) | `business-config.ts`, `config-admin.ts`, `/admin/settings` | Unit-tested (`config.test.ts`) |
| Policies / terms | `data/policies.ts`, `VenueTerms` | Unit-tested (`policies.test.ts`) |
| Menu display / lightbox | `MenuBrowser`, `public/menu/*` | Unit-tested (`menu-images.test.ts`); content is Sadiq Pearl's |
| CSP, rate limiting, security log, password policy | `lib/security/*`, `lib/auth/password-policy.ts` | Unit-tested (`security.test.ts`) |
| Auth (email, Google, reset, verification, session cookie, admin MFA) | `lib/auth/*`, `components/auth/*` | Not run here. The reference reports say Google sign-in on the real domain was never run. |
| Firestore security rules | `firestore.rules` | **Not run here** |
| WhatsApp contact / admin composer | `lib/whatsapp.ts`, `WhatsAppComposer` | Link building only; no API |

## 3. Design screen → feature mapping

| Approved screen | Reference route / module | Fit |
|---|---|---|
| Home | `(site)/page.tsx` + `Hero`, `About`, `Amenities`, `Events`, `Menus`, `Gallery`, `Reviews`, `Location`, `FinalCta` | **Adapt**: new layout. Its "quick date check" maps to `api/availability`. |
| About & Facilities | Same section components; no separate route | **Adapt**: new route `/about`; facts must come from Sabor con Amor |
| Menus & Packages (+ "Interactive Event Estimation Engine") | `MenuBrowser`, `business-config` menus/packages, `PriceBreakdown`/`pricing.ts` | **Adapt**: the estimator can reuse `pricing.ts`. It shows "pricing pending" until prices are configured. |
| Gallery + lightbox | `(site)/gallery`, `data/gallery.ts` | **Reuse logic**, replace content |
| Contact & Booking Enquiry | `/book` + `BookingRequestFlow` (sign-in gated) | **Adapt**: the design shows an open enquiry form with hall preference, alternate date, guest slider and add-ons. The reference **retired** its anonymous enquiry form, so an open form needs a decision (see §8). |
| Customer Login / Sign Up / Password Reset | `(auth)/login`, `signup`, `forgot-password`, `auth/action` | **Reuse logic**, restyle |
| Customer Dashboard | `(account)/account` | **Reuse**, restyle |
| My Bookings | `(account)/account/bookings` | **Reuse**, restyle |
| Booking Details Dossier | `(account)/account/bookings/[bookingId]` | **Adapt**: design-only extras (production timeline, CAD stage blueprint, tasting matrix) have no backing data |
| Admin Access Gateway | `(admin-auth)/admin/login` (+ MFA) | **Reuse**, restyle; drop "Emergency IT Dispatch" unless a real contact exists |
| Admin Overview Dashboard | `(admin)/admin` + `admin-stats`, `admin-alerts` | **Adapt**: KPIs, upcoming events and pending queue exist. Power-grid telemetry, staff roster and hall turnaround have **no backing data**. |
| Admin Booking Management | `(admin)/admin/bookings*` | **Reuse**, restyle |
| Admin Calendar & Date Locks | `(admin)/admin/calendar` + `BlockedSlots` | **Reuse**, restyle |
| Admin Menus & Degustation Matrix | `(admin)/admin/settings` (menus, packages, prices) | **Adapt**: the per-head price matrix fits the `per_guest` pricing mode |
| Admin Customer CRM | `(admin)/admin/customers*` | **Reuse**, restyle |
| — (no design) | `/reviews`, `/account/notifications`, `/account/profile`, `/admin/events`, `/admin/vendors`, `/admin/reviews`, `/admin/reports`, `/admin/communications`, `/admin/settings` (other tabs) | **Working features with no approved screen.** They need styling from the design system, not a new design. Decide whether to keep them. |

## 4. Reuse / adapt / missing matrix

**Reuse directly (logic unchanged, restyle only):** booking engine, availability and slot locks, status model, admin booking actions, manual bookings, blocks, finance (quotations, payments, receipts, PDF), customer portal, change requests, reviews and moderation, notifications, CRM and notes, event operations and vendors, settings editor, auth flows, session cookies, MFA switch, CSP, rate limiting, security log, Firestore rules and indexes, tests and CI.

**Adapt (change config or UI):** home and section components (new design), menus display (new content), gallery (new content), booking flow UI (design fields), admin dashboard (design KPIs that real data supports), business identity (`lib/config.ts`), default business config (`DEFAULT_CONFIG`: hall name and capacity, event types, transcribed menus), SEO and structured data, WhatsApp default message.

**Missing, needing new business requirements before they can be built:**
1. **Halls / spaces.** The signage confirms Banquet Hall, Restaurant and Rooftop BBQ. Hall count, names and capacities are unknown. The design's "Grand Mughal Pavilion", "Crystal Glass Atrium" and "Royal Courtyard Lawn" are placeholders. Multi-hall booking is supported by the config schema, but whether the engine handles more than one hall at runtime needs code verification before relying on it.
2. **Restaurant and Rooftop BBQ.** Should the site take table reservations or food orders for these? The reference has **no** restaurant reservation or ordering feature.
3. Slot names and times, booking rules, minimum guests and hold hours.
4. Menus, packages, add-on services and **all prices**.
5. Contact numbers, WhatsApp, email, address, map link, social accounts, opening and visiting hours.
6. Policies and terms (advance, cancellation, refunds).
7. Production domain, Firebase project and Vercel project.
8. Open (anonymous) enquiry form or sign-in-gated booking only.
9. Design-only modules with no data source: power and generator telemetry, CAD stage layouts, staff leadership roster, tasting appointments, "45-minute walkthrough" booking, valet capacity, response-time SLA. **I recommend omitting these** unless you supply real requirements.

## 5. Sadiq Pearl branding & configuration that must not leak

| Area | Location |
|---|---|
| Business identity: name, short name, tagline, 4 phone numbers, WhatsApp number, address, Google rating/count, Maps link, TikTok | `src/lib/config.ts` (`business`) |
| Fallback domain `www.sadiqpearlmarquee.com` | `src/lib/config.ts`, warning text in `next.config.mjs` |
| WhatsApp default message naming Sadiq Pearl | `src/lib/whatsapp.ts` |
| Transcribed menus, gallery captions, events, reviews, highlights, policies | `src/data/*.ts`, `SADIQ_PEARL_OFFICIAL_POLICIES.md` |
| Default hall (capacity 1,000), event types, menus | `DEFAULT_CONFIG` in `src/lib/config/business-config.ts` |
| All images, videos, menu cards, menu PDF, logo, favicon | `public/images/**`, `public/videos/**`, `public/menu/**`, `public/favicon.ico` |
| Env names `SADIQ_PEARL_ADMIN_MFA_REQUIRED`, `SADIQ_PEARL_APPCHECK_ENFORCE`, `SADIQ_PEARL_E2E_SEED`, `SADIQ_PEARL_E2E_MEMORY_STORE` | code + `.env.example` |
| Emulator project `demo-sadiq-pearl` | `package.json` scripts, CI workflow, tests |
| Internal identifiers (`sadiqPearlFirebase`, `sadiqPearlPublicConfig`, `sadiqPearlAppCheck`, `sadiqPearlRate…`) | ~40 files under `src/` |
| Package name `sadiq-pearl-marquee`, README, CI working-directory | `package.json`, `README.md`, `.github/workflows/ci.yml` |
| Phase reports, screenshots, scanned PDF, logs | `SADIQ_PEARL_*.md`, `CamScanner…pdf`, `*-debug.log`, screenshot folders |
| Firebase and Vercel project bindings | `.env.local`, `.vercel/project.json` — **never copy** |

The **design files** have their own placeholder identity, and it must not ship: "Pak Marquee" and "Pak Marquee Hospitality Group", "Islamabad G-5", "Faisalabad Marquee", fake `+92…` numbers, `concierge@pakmarquee.pk`, invented halls, invented PKR prices and stats ("650+ vehicles", "1,800+ guests", "28 ft high"), named fake staff and clients, and 86 `lh3.googleusercontent.com` stock images. They also load **Tailwind from a CDN**, which is incompatible with the reference's nonce CSP. The design must be rebuilt as components using `DESIGN.md` tokens, not pasted in as HTML.

## 6. Security & integration risks

1. **CRITICAL: live credentials are inside the reference ZIP.** `sadiq-pearl-marquee-firebase-adminsdk-fbsvc-*.json` contains a `private_key`. `.env.local` holds values for `FIREBASE_ADMIN_PRIVATE_KEY`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PROJECT_ID` and `VERCEL_OIDC_TOKEN`, plus the public Firebase config. They are git-ignored, but the ZIP itself spreads them. Anyone with the ZIP has admin access to Sadiq Pearl's Firebase project. **Rotate the service-account key and treat the Vercel token as exposed.** The reference's own report already lists key rotation as an outstanding owner action. None of these files will be copied into Sabor con Amor.
2. **Separate Firebase project required.** Pointing Sabor con Amor at Sadiq Pearl's Firestore would expose real customer bookings. Sabor con Amor needs its own Firebase project, its own admin, and its rules deployed.
3. Debug logs (`firebase-debug.log`, `firestore-debug.log`) may contain tokens or emails. Exclude them.
4. Rules and Firestore-adapter tests are **unverified** (§2). Run them before relying on authorization.
5. Production hardening still open in the reference: admin MFA off, App Check unset, no Firestore backups, rate limits per instance only, no billing budget.
6. **Privacy:** the event video shows identifiable guests, the groom's party, children and staff. Get consent before publishing (details in the media inventory).
7. Design CDN scripts and remote images conflict with the CSP. Local fonts via `next/font` and local images are required.

### Required environment variables (names only)
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `NEXT_PUBLIC_SITE_URL`. Optional: `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, `SECURITY_LOG_SALT`, the two `SADIQ_PEARL_*` switches (to be renamed), and the emulator variables.
**Sabor con Amor status: none are configured.** There is no Firebase project, domain or `.env.local` yet. The reference values belong to Sadiq Pearl and must not be reused.

## 7. Proposed implementation sequence

Each phase ends with typecheck, lint and `test:booking` passing, plus a short report. Nothing starts without your approval.

| Phase | Scope (files / modules) | Depends on | Risks | Acceptance criteria |
|---|---|---|---|---|
| **1. Bootstrap** | In the Sabor con Amor folder, copy reference **source only**: `src/`, `tests/`, `scripts/`, configs, `firestore.*`, `storage.rules`, `.env.example`, `.github/`. Exclude `node_modules`, `.next`, `.git`, `.env.local`, the service-account JSON, `.vercel`, logs, reports, screenshots, `public/**` media and the scanned PDF. Then `git init` and `npm ci` from the lockfile. | Target directory confirmed | Accidentally copying secrets | `git status` shows no secret or log files; typecheck and lint pass; 257/257 unit tests pass; `npm run build` passes in the "not configured" state |
| **2. De-brand & neutral config** | `package.json` name, `README`, CI; `lib/config.ts` (Sabor con Amor; unconfirmed fields `null` and hidden); `lib/whatsapp.ts`; `data/*.ts` emptied or replaced; `DEFAULT_CONFIG`; env prefix `SADIQ_PEARL_*` → `SABOR_*`; `demo-sadiq-pearl` → `demo-sabor-con-amor`; internal identifiers; test fixtures | Phase 1; env rename approval | Tests coupled to Sadiq data | `grep -ri "sadiq\|pearl"` across `src tests scripts` and configs returns nothing; all tests pass |
| **3. Design system** | `tailwind.config.ts` tokens from `DESIGN.md` (emerald, antique gold, ivory, status palette); Playfair Display and Plus Jakarta Sans via `next/font`; shared UI primitives (buttons, cards, badges, inputs, nav, footer, admin shell) | Phase 2 | CSP or font loading | Token parity with `DESIGN.md`; no CDN scripts; CSP still passes `security.test.ts` |
| **4. Public site** | Home, About & Facilities, Menus & Packages, Gallery + lightbox, Contact & Booking Enquiry (restyled `/book`); authentic media from `media/04_website_ready/`; placeholder stats removed | Phase 3; media approval; business facts (§4) | Missing facts leave sections empty | Screens match approved layouts at 1280 / 390 / 320; no invented facts; availability check works against emulator data |
| **5. Auth screens** | Login, Sign Up, Password Reset, email action | Phase 3 | Google popup / COOP | Email and Google flows work against the Auth emulator |
| **6. Customer portal** | Dashboard, My Bookings, Booking Details | Phases 3, 5 | Design-only dossier sections | Existing portal tests pass; restyled pages show only real data |
| **7. Admin** | Gateway, Overview, Booking Management, Calendar & Locks, Menus matrix (settings), CRM; style the undesigned admin pages | Phases 3, 5 | Overview KPIs without data | Admin tests pass; no telemetry or roster placeholders |
| **8. Firebase project & security** | New Firebase project; deploy rules and indexes; `set-super-admin`; run `test:rules` and `test:booking:firestore` (Java 21 + firebase-tools 15.31.0); App Check; MFA | You create the project and provide credentials | Rules gaps | Rules and Firestore suites pass on the emulator |
| **9. Content & launch** | Real menus, prices, policies, contact, domain, SEO, sitemap; Vercel project; E2E pass | All business inputs | Unconfirmed content | `NEXT_PUBLIC_SITE_URL` set; checklist signed off |

## 8. Decisions needed from you

1. ~~Working directory location~~ — resolved: `C:\Users\sheharyar\OneDrive\Desktop\Sabor con Amor`. Phase 1 will place the app source alongside this audit and `media/` (layout to confirm at Phase 1).
2. Scope for **Restaurant and Rooftop BBQ**: venue information only, or table reservations?
3. Hall list, capacities, slots and times.
4. Open enquiry form (as in the design) or sign-in-gated booking (as in the reference).
5. Approval to rename the `SADIQ_PEARL_*` env variables and identifiers.
6. Approval to omit design-only modules with no data source (§4 item 9).
7. Contact details, menus, prices, policies and domain, whenever they are available.

## 9. Commands

After Phase 1, run these from the new project root. They come from the reference `package.json`; the emulator project ID changes in Phase 2.

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test:booking
npm run build
npm run test:rules
npm run test:booking:firestore
```

`test:rules` and `test:booking:firestore` need `npm install --global firebase-tools@15.31.0` and Java 21+. Neither is present on this machine; Java 17 is installed.
