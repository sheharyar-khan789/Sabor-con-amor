# Sabor con Amor — Design Mapping

Approved designs: `design/stitch/<screen>/code.html` and `screen.png`, 17 screens, plus the design system in `design/stitch/design_system/DESIGN.md`. The originals are in `Downloads\stitch_pak_marquee_ui_ux_system.zip` (unchanged).

It maps each approved screen to the product structure and the code it is built on. **Phase 3 implemented the customer screens** (sign up, login with Google, password recovery, customer dashboard, my bookings, booking details, profile) on the Stitch design system, under the `.theme-sabor` scope; see `IMPLEMENTATION_ROADMAP.md` → Phase 3 record. The public website and admin screens are not implemented yet.

## 1. What was rebranded in Phase 1, and what was not

- Folders were renamed from `stitch_pak_marquee_ui_ux_system/pak_marquee_<screen>` to `stitch/<screen>`; `narrative_system` became `design_system`.
- In every `code.html`, the brand strings "Pak Marquee", "PAK MARQUEE" and "Pak Marquee Hospitality Group Ltd." became "Sabor con Amor". The fake email domain `pakmarquee.pk` became `placeholder.invalid`, so no Sabor con Amor email address was invented. Each file now starts with a comment marking all its content as placeholder.
- `DESIGN.md` front-matter name changed to "Sabor con Amor Design System". Tokens and guidance are unchanged.
- **`screen.png` images cannot be edited and still show "Pak Marquee".** Treat them as layout references only.
- Phase 1 deliberately left the invented halls, capacities, phone numbers, addresses, prices, statistics, names, testimonials and stock images untouched, rather than relabel them as Sabor con Amor facts.

### Phase 2: fabricated content removed (structure kept)

Script-driven, then reviewed against a full dump of every screen's visible text and headless-browser renders.
- **Business facts → placeholders.** Specifications, capacities, statistics, prices, phone numbers, emails, Islamabad addresses, invented halls, people, organisations, photographers, dishes, packages, facility and certification claims, staff-roster entries and sample booking records now read "To be confirmed", "Name placeholder", "Price to be confirmed", "Menu item to be confirmed", "Feature to be confirmed" and similar. Long marketing paragraphs read "Description to be confirmed."
- **Removed outright (no requirements or data):** generator / power-grid / redundancy / telemetry items, stage CAD / blueprint / "Spatial Layouts & Stage" blocks and the blueprint viewer script, and "Emergency IT Dispatch".
- **Images:** all 86 stock images (including inline-style backgrounds) now use approved Sabor con Amor media from `media/04_website_ready/`, with alt text describing the real photo. Logo and avatar slots show neutral placeholders. Stock-photo `data-alt` descriptions were deleted. The "do not publish" frame is never used.
- **Labels mapped to the approved product structure:** "Estate Settings" → Business Settings, "Menus & Degustation" → Menus & Packages, "Quotations & Ledger" → Quotations & Payments, "Client Portal" → Customer Panel. The brand sub-line is now "Banquet Hall · Restaurant · Rooftop BBQ" and the footer tagline is "Taste with love" (from signage; to confirm).
- **Scripts and comments:** the gallery lightbox data, the demo login credentials and the package names were neutralized. Generator-written developer comments were removed. Fake `tel:` / `mailto:` links point to `#`.
- **Kept as layout placeholders (not facts):** small numerals in the admin mock-ups (KPI counts, calendar day numbers, badge counts), two-letter avatar initials, generic UI micro-copy, and event-type labels (Barat / Walima / Mehndi / Nikkah, unverified: open decision 15).
- **Not changed:** layout, Tailwind classes, colours, typography, component hierarchy and responsive breakpoints. The `screen.png` files are unchanged and still show the original placeholder content.
- Backup of the Phase 1 versions (session scratch only): `design_backup_phase1/`.

- The `code.html` files still load Tailwind from a CDN, which is incompatible with the app's nonce CSP. Screens must be rebuilt as React components with local assets, not embedded.

## 2. Design system

From `design_system/DESIGN.md`: "Heritage Modernism / Restrained Editorial Luxury".

- **Colours:** Imperial Emerald primary `#0F2E24` / `#184235`; antique gold accent `#C5A059` (highlight `#DFBD78`, deep `#9A7736`); ivory surfaces `#FAF8F5` / `#F5F1EA` / `#EBE5DA`; ink `#1A211E`.
- **Status colours:** confirmed (emerald), pending (amber), in review (sapphire), cancelled (crimson).
- **Type:** Playfair Display for display and headings; Plus Jakarta Sans for body, UI and tabular figures (`tnum`).
- **Radius and spacing:** small radii (0.125–0.75 rem); gutter 1.5 rem (0.75 rem on mobile); margin 2.5 rem (1 rem on mobile).

The current `tailwind.config.ts` and fonts (Cormorant Garamond) are the **reference project's** "Noir + champagne gold" tokens. Replacing them is a later phase.

**Responsive intent:** every screen's `code.html` uses Tailwind `sm:`, `md:` and `lg:` breakpoints, so desktop, tablet and mobile behaviour is defined in markup. Each `screen.png` is a single render. Build and verify each screen at roughly 1280, 768 and 390/320 px.

## 3. Screen → product area → existing code

### Public website

| Product page | Approved screen | Existing code to build on | Gaps / placeholder to replace |
|---|---|---|---|
| Home | `home` | `src/app/(site)/page.tsx`, `components/Hero`, `About`, `Events`, `Menus`, `Gallery`, `FinalCta`; quick date check → `api/availability` | Stats ("1,800+ guests", "650+ vehicles", "28 ft"), named halls, PKR prices, stock photos |
| About & Facilities | `about_facilities` | Section components; new route | Hall names and capacities, facilities list (unverified) |
| Menus & Packages | `menus_packages` | `components/MenuBrowser`, business-config `menus`/`packages`, `lib/booking/pricing.ts` (estimator) | All menus, packages and prices; the estimator shows "pricing pending" until prices are configured |
| Gallery | `gallery_lightbox` | `src/app/(site)/gallery`, `components/Gallery`, `src/data/gallery.ts` | 22 stock images, captions with invented hall names |
| Contact & Booking Enquiry | `contact_booking_enquiry` | `src/app/(site)/book`, `components/booking/BookingRequestFlow` (sign-in gated), `lib/whatsapp.ts` | Phone, email, address, map, hours; open vs sign-in enquiry undecided; hall choice not supported |

### Customer panel

| Product page | Approved screen | Existing code | Notes |
|---|---|---|---|
| Sign Up | `customer_sign_up` (has "Sign Up with Google") | `src/app/(auth)/signup`, `components/auth/SignupForm`, `GoogleButton` | Restyle |
| Login | `customer_login` (has "Continue with Google") | `src/app/(auth)/login`, `LoginForm` | Restyle |
| Google Sign-In | inside the two screens above | `GoogleButton`, `AuthProvider` | Needs Google provider enabled on the new Firebase project |
| Password Recovery | `password_reset_recovery` | `src/app/(auth)/forgot-password`, `auth/action`, `ForgotPasswordForm`, `EmailActionHandler` | Design shows a multi-step flow; check against Firebase's email-link reset |
| Customer Dashboard | `customer_dashboard` | `src/app/(account)/account` | Restyle; show only real data |
| My Bookings | `my_bookings` | `src/app/(account)/account/bookings`, `BookingCard`, `BookingSections` | Restyle |
| Booking Details | `booking_details_dossier` | `src/app/(account)/account/bookings/[bookingId]`, `ChangeRequests`, `ReviewForm` | Production timeline, CAD stage blueprint and tasting matrix have **no data**; omit unless requirements arrive |
| Profile / Settings | **no approved screen** | `src/app/(account)/account/profile`, `ProfileForm`, `EmailChangeForm`, `DeleteAccountForm`; also `/account/notifications` | Build from design-system components |

### Admin area

| Product page | Approved screen | Existing code | Notes |
|---|---|---|---|
| Admin Login | `admin_estate_access_gateway` | `src/app/(admin-auth)/admin/login`, `AdminLoginForm`, MFA | Drop "Emergency IT Dispatch" unless a real contact exists |
| Dashboard Overview | `admin_overview_dashboard` | `src/app/(admin)/admin`, `lib/booking/admin-stats.ts`, `admin-alerts.ts` | Keep KPIs, upcoming events and pending queue. **Omit** power/generator telemetry, staff roster and hall turnaround (no data) |
| Bookings | `admin_booking_management` | `src/app/(admin)/admin/bookings*`, `BookingActions`, `EditBookingForm`, `ManualBookingForm` | Restyle |
| Customers | `admin_customer_crm_patron_profiles` | `src/app/(admin)/admin/customers*`, `CustomerForms` | Restyle |
| Menus & Packages | `admin_menus_degustation_matrix` | `src/app/(admin)/admin/settings` (`settings/EntityManager`, `SettingsForms`) | The per-head matrix maps to the `per_guest` pricing mode |
| Gallery | **no approved screen** (nav item "Gallery & Media") | **no existing feature** | Needs a storage decision (Firebase Storage is disabled) |
| Availability / Calendar | `admin_calendar_date_locks` | `src/app/(admin)/admin/calendar`, `BlockedSlots`, `api/admin/slots/*` | Restyle |
| Quotations & Payments | **no approved screen** (nav item "Quotations & Ledger") | `FinancePanel`, `api/admin/bookings/[id]/quotations|payments`, `api/admin/quotations/*`, `api/documents/*` | Build from design-system components |
| Website Content & Business Settings | **no approved screen** (nav item "Estate Settings") | `src/app/(admin)/admin/settings` (business config only) | Website content editing does not exist |
| *(design nav only)* | "Spatial Layouts & Stage", "Security & Access Logs" | none / security log is server-side only | Out of scope without verified requirements |

### Existing reference features with no slot in the approved structure

`/reviews` (public), `/admin/events`, `/admin/vendors`, `/admin/reviews`, `/admin/reports`, `/admin/communications`. Whether to keep them is an open decision (see `IMPLEMENTATION_ROADMAP.md`).

## 4. Authentic media for each section

From `media/MEDIA_INVENTORY.md`. Use only files from `media/04_website_ready/`.

| Section | Media |
|---|---|
| Home hero | Tour video drone segment 33.5–37.9 s (poster `exterior/frame_tour_exterior-drone-dusk-b_t036s20.jpg`); desktop still `banquet-hall/hall_sofa-aisle-central-chandelier.jpg` |
| About | `interior/lobby_marble-floral-chandeliers.jpg`, exterior frames |
| Facilities: Banquet Hall | `banquet-hall/*` |
| Facilities: Restaurant / Rooftop BBQ | **none available** (signage only) |
| Menus | `food-service/frame_event_food-desserts-logo-wall_t034s33.jpg` + other food-service frames (staff consent needed where noted) |
| Gallery, decor, stage | `stage-and-decor/*`, `dining-setup/*`, `banquet-hall/*` |
| Contact / location | `exterior/frame_event_exterior-drone-road-*`, `signage/*` |
| Auth side images | `banquet-hall/hall_sofa-aisle-central-chandelier.jpg` |

**Never use** `media/03_video_frames/NOT-RECOMMENDED/*`. All sources are WhatsApp-compressed (frames 576×1024), so a sharp desktop hero needs original footage.
