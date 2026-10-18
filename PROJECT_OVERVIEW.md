# Sabor con Amor — Project Overview

**Status: Phases 0–6 complete (customer panel and admin built on the Sabor con Amor design system; QA and security review done). Not production-ready: no Firebase project or confirmed business details yet — see `IMPLEMENTATION_ROADMAP.md` → Phase 6 record.**

## What this project is

The website and management platform for **Sabor con Amor**. The venue's own signage confirms three services: **Banquet Hall**, **Restaurant** and **Rooftop BBQ**. No other business facts have been confirmed yet (see `IMPLEMENTATION_ROADMAP.md` → Open decisions).

It has three product areas:

- **Public website:** Home, About & Facilities, Menus & Packages, Gallery, Contact & Booking Enquiry.
- **Customer panel:** sign up, login (including Google), password recovery, dashboard, my bookings, booking details, profile and settings.
- **Admin area (separate):** admin login, dashboard, bookings, customers, menus and packages, gallery, availability calendar, quotations and payments, website content and business settings.

## Where it came from

The source code was bootstrapped in Phase 1 from the **Sadiq Pearl Marquee** reference project, a working Next.js + Firebase venue-booking platform. Only source and configuration were copied. These were **excluded**: secrets (`.env.local`, the Firebase Admin key, the Vercel binding), logs, phase reports, screenshots, the scanned PDF, and all Sadiq Pearl media (`public/`). The reference project itself was not modified.

**Phase 2 removed the Sadiq Pearl content** (contact details, menus, gallery, reviews, policies, media, page copy). Unconfirmed Sabor con Amor details are empty and hidden. Some booking defaults are still inherited (capacity, Day/Night slots, event types, time zone), listed in `IMPLEMENTATION_ROADMAP.md` → "Still inherited". **Not ready to deploy:** there is no Firebase project, no confirmed contact details, menus or prices, and the new design system is not built yet.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | Next.js App Router application (reference code, partly rebranded) |
| `tests/` | Node test-runner suites (`tests/booking`) and Firestore-emulator suites (`tests/firestore`) |
| `scripts/` | Super-admin bootstrap, session revocation, security-rules test runner |
| `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json` | Firebase rules, indexes, emulator config |
| `design/stitch/` | Approved Google Stitch screens (`<screen>/code.html`, `<screen>/screen.png`) and `design_system/DESIGN.md` |
| `media/` | Authentic Sabor con Amor media: originals, categorized photos, extracted video frames, web-ready copies, manifest (`media/MEDIA_INVENTORY.md`) |
| `SABOR_PHASE_0_AUDIT.md` | Phase 0 reference audit |
| `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DESIGN_MAPPING.md`, `IMPLEMENTATION_ROADMAP.md` | Phase 1 documentation |
| `.github/` | CI workflow (typecheck, lint, unit tests, build; emulator suites) and Dependabot |

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test:booking
npm run build
```

`npm run test:rules` and `npm run test:booking:firestore` use the Firebase emulators. They need `firebase-tools@15.31.0` installed globally and Java 21 or newer. Neither is installed on the current development machine (it has Java 17), so these suites have not been run.

## Ground rules

- Use only real Sabor con Amor facts and media. Never ship the Stitch placeholder content (see `DESIGN_MAPPING.md`).
- Never publish `media/03_video_frames/NOT-RECOMMENDED/*`. Frames showing identifiable guests or staff need consent first.
- Use a dedicated Sabor con Amor Firebase project. Never use Sadiq Pearl credentials or data.
- Next.js in this project is v16. Read `AGENTS.md` and `node_modules/next/dist/docs/` before writing framework code.
