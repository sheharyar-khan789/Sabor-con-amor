# Sabor con Amor — Architecture

This describes the architecture **as inherited from the reference project and checked in its code**. "Existing" means the code is present and, where noted, unit-tested. It does not mean it has been verified for Sabor con Amor at runtime. Nothing here is deployed.

## 1. Stack

| Layer | Technology | Source |
|---|---|---|
| Framework | Next.js `^16.3.8` (App Router), React `^19.3.0`, TypeScript 5 | `package.json` |
| Styling | Tailwind CSS 3.4, fonts via `next/font` (currently Cormorant Garamond + Plus Jakarta Sans) | `tailwind.config.ts`, `src/app/layout.tsx` |
| Server | Next.js route handlers in `src/app/api/**`; request proxy `src/proxy.ts` (nonce CSP) | — |
| Auth | Firebase Authentication (email/password, Google) + server session cookies via Firebase Admin | `src/lib/auth/*`, `src/app/api/auth/session` |
| Database | Cloud Firestore through a store interface (`firestore-store.ts` in production, `testing/memory-store.ts` in tests) | `src/lib/booking/store.ts` |
| File storage | Firebase Storage **not used**; `storage.rules` denies everything; media is static under `public/` | `storage.rules` |
| Documents | `pdf-lib` generates quotation and receipt PDFs | `src/lib/booking/documents-pdf.ts` |
| Hosting | Vercel in the reference (binding not copied) | — |
| Runtime | Node `>=20.9.0` (CI: Node 24) | `package.json`, `.github/workflows/ci.yml` |

No new dependencies were added in Phase 1.

## 2. Route map

### Existing routes (reference code, not yet styled for Sabor con Amor)

| Area | Route | File |
|---|---|---|
| Public | `/` | `src/app/(site)/page.tsx` |
| Public | `/book` | `src/app/(site)/book/page.tsx` |
| Public | `/gallery` | `src/app/(site)/gallery/page.tsx` |
| Public | `/reviews` | `src/app/(site)/reviews/page.tsx` |
| Auth | `/login`, `/signup`, `/forgot-password`, `/auth/action` | `src/app/(auth)/**` |
| Customer | `/account`, `/account/bookings`, `/account/bookings/[bookingId]`, `/account/notifications`, `/account/profile` | `src/app/(account)/**` |
| Admin auth | `/admin/login` | `src/app/(admin-auth)/admin/login` |
| Admin | `/admin`, `/admin/bookings` (+`/new`, `/[bookingId]`), `/admin/calendar`, `/admin/customers` (+`/[uid]`), `/admin/events` (+`/[bookingId]`), `/admin/communications`, `/admin/reports`, `/admin/reviews`, `/admin/settings`, `/admin/vendors` (+`/[vendorId]`) | `src/app/(admin)/**` |
| SEO | `/robots.txt`, `/sitemap.xml` | `src/app/robots.ts`, `src/app/sitemap.ts` |

### Target route map (planned, **not implemented**)

| Product area | Planned route | Based on |
|---|---|---|
| Home | `/` | existing `/` |
| About & Facilities | `/about` *(new)* | existing section components |
| Menus & Packages | `/menus` *(new)* | `MenuBrowser`, business-config menus/packages |
| Gallery | `/gallery` | existing |
| Contact & Booking Enquiry | `/contact` *(new)* and/or `/book` | existing `/book`; enquiry access rule undecided |
| Sign Up / Login / Google / Recovery | `/signup`, `/login`, `/forgot-password`, `/auth/action` | existing |
| Customer dashboard, bookings, details, profile | `/account`, `/account/bookings`, `/account/bookings/[id]`, `/account/profile` | existing |
| Admin login | `/admin/login` | existing |
| Admin dashboard, bookings, customers, calendar | `/admin`, `/admin/bookings`, `/admin/customers`, `/admin/calendar` | existing |
| Admin menus & packages | `/admin/menus` (Phase 4) | settings editors, moved |
| Admin gallery | `/admin/gallery` (Phase 4, read-only) | uploads need storage (decision 8) |
| Admin quotations & payments | `/admin/finance` (Phase 4, read-only overview) + booking detail actions | existing finance APIs + `FinancePanel` |
| Admin website content & business settings | `/admin/content` (Phase 4, read-only) + `/admin/settings` | content editing not available (decision 9) |

Final paths are decided in the phase that builds each area.

## 3. Component and layout boundaries

- **Root layout** `src/app/layout.tsx`: fonts, metadata, CSP nonce bootstrap script. Shared by all areas.
- **Route-group layouts:** `(site)/layout.tsx` (public nav and footer), `(auth)/layout.tsx` (auth frame), `(account)/layout.tsx` (customer portal shell, sign-in required), `(admin)/layout.tsx` (admin shell, admin role required), `(admin-auth)` (admin login, no shell). These groups are the boundaries the new design should keep.
- **Components:** `src/components/` holds public sections (`Hero`, `About`, `Amenities`, `Events`, `Menus`, `Gallery`, …), `auth/`, `account/`, `admin/` (incl. `settings/`) and `booking/`. Domain logic lives in `src/lib/**`, not in components, so restyling should not need logic changes.
- **Content:** business identity in `src/lib/config.ts`; static content in `src/data/*.ts`; editable venue setup in Firestore `businessConfig/main` (`src/lib/config/business-config.ts`).

## 4. Authentication and authorization

- **Customers:** Firebase Auth email/password with email verification, or Google sign-in. A server session cookie is created through `api/auth/session` (`createSessionCookie`). The `(account)` layout and `api/account/*` require a valid session.
- **Admins:** every admin page calls `requireSuperAdmin()` itself (Phase 4), in addition to the layout. Roles come from a Firebase **custom claim** (`super_admin`; `admin` also appears in the code), set only by `scripts/set-super-admin.mjs` with server credentials. They are never set from client input. The `(admin)` layout and `api/admin/*` check the role on the server. Sensitive actions re-authenticate (`AdminReauth`).
- **Admin MFA:** TOTP second factor, enforced when `SABOR_ADMIN_MFA_REQUIRED=true`. This needs Identity Platform with TOTP enabled on the Firebase project first.
- **App Check:** optional. It needs `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` **and** `SABOR_APPCHECK_ENFORCE=true`.
- **Firestore rules** (`firestore.rules`) restrict collections by owner and role.
- **Hardening:** nonce CSP (`src/lib/security/csp.ts`), security headers (`next.config.mjs`), per-instance rate limits, and a hashed security log (`SECURITY_LOG_SALT`).

## 5. Data entities (Firestore collections)

Checked in `firestore.rules` and the model files under `src/lib/booking/`.

| Collection | Entity | Key relationships |
|---|---|---|
| `users` | Customer profile (`CustomerProfile`) | keyed by Firebase Auth uid |
| `bookings` | `BookingRecord`: `hallId`, `slotId`, event date, `eventTypeId`, `guestCount`, `status`, `createdBy {kind, uid}` | customer uid; hall, slot and event type from business config |
| `slotLocks` | `SlotLock` per date × hall × slot | → `bookingId`; enforces one booking per slot |
| `bookingRequests` | Customer change/cancel requests | → `bookingId` |
| `payments` | `PaymentRecord` (recorded / voided) | → `bookingId` |
| `quotations` | `QuotationRecord` (snapshot of pricing) | → `bookingId` |
| `counters` | Sequential document numbers | — |
| `reviews` | `ReviewRecord` (moderated) | → booking and customer |
| `notifications` | In-app customer notifications | → customer uid |
| `communications` | Log of admin WhatsApp messages (links only) | → booking or customer |
| `customerNotes` | Admin CRM notes | → customer uid |
| `eventOperations` | Event checklist, notes, ops status | → `bookingId` |
| `vendors`, `vendorAssignments` | Vendors and their assignment to events | assignment → `bookingId` + `vendorId` |
| `businessConfig` | One versioned document: halls, slots, rules, event types, services, menus, packages, pricing, policies | referenced by bookings |
| `adminAudit`, `adminState` | Audit trail, admin alert state | → admin actor |

**Booking statuses:** `pending`, `under_review`, `confirmed`, `completed`, `cancelled`, `rejected`, `expired`. A slot is held while a booking is pending, under review, confirmed or completed.
**Halls:** the config, engine, slot locks and pricing are hall-aware (`hallId`). The public booking flow (`BookingRequestFlow.tsx`) always books the **default hall only**. Offering a hall choice to customers would be new work.

Collection names contain no brand and were **not renamed**.

## 6. Reusable features (reference, pending re-verification for Sabor con Amor)

These were unit-tested in the reference: booking engine and availability; admin booking actions, edit, archive and delete; date and slot blocks; finance (pricing, quotations, payments, void, receipts); customer portal and change requests; reviews and moderation; notifications; CRM notes; event operations and vendors; business settings; policies; CSP, rate limits, security log and password policy.
**Not verified anywhere yet:** Firestore security rules and the Firestore adapter (emulator suites), PDF output, and every UI flow at runtime.

## 7. Not supported by the existing code

- Restaurant or rooftop table reservations, and food ordering.
- Customer choice between halls.
- Admin gallery and media management (no Storage; gallery is a static `src/data/gallery.ts`).
- Website content editing (content lives in code files).
- Email or SMS notifications (in-app only; WhatsApp works through `wa.me` links).
- Design-only modules (generator/power telemetry, stage CAD layouts, staff roster, tasting appointments): no requirements or data.

## 8. Environment variables

Names only. See `.env.example` for placeholders and comments. **No Sabor con Amor values exist yet.**
Required: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, `NEXT_PUBLIC_SITE_URL`.
Optional: `SABOR_ADMIN_MFA_REQUIRED`, `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, `SABOR_APPCHECK_ENFORCE`, `SECURITY_LOG_SALT`.
Test and local only: `SABOR_E2E_MEMORY_STORE`, `SABOR_E2E_SEED`, `NEXT_PUBLIC_FIREBASE_USE_EMULATORS`, `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`.
Phase 1 renamed these from their reference names (`SADIQ_PEARL_ADMIN_MFA_REQUIRED`, `SADIQ_PEARL_APPCHECK_ENFORCE`, `SADIQ_PEARL_E2E_MEMORY_STORE`, `SADIQ_PEARL_E2E_SEED`). No Sabor con Amor deployment used the old names, so nothing depended on them.
