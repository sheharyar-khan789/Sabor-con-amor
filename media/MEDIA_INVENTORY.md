# Sabor con Amor — Media Inventory & Selection

Source: `WhatsApp Unknown 2026-10-15 at 23.04.10.zip` (12 files). Every file was opened and reviewed. Both videos were reviewed at 1 frame per second, and every selected frame was checked visually.
The originals are unchanged: byte-identical copies are in `01_originals/` (MD5 verified). Full per-file data is in `media_manifest.csv` / `media_manifest.json`.

## What the media establishes (and nothing more)

- The building's lit signage reads **SABOR CON AMOR**, **ROOFTOP BBQ**, **RESTAURANT** and **BANQUET HALL**. The roadside pole sign adds the line "TASTE WITH LOVE" and lists "Banquet Hall · Restaurant · Roof Top BBQ".
- There is a large banquet hall with gilded ceilings, crystal chandeliers, sofa lounge seating, dining tables and a floral stage, plus a marble lobby with a staircase.
- Food appears **only** as event catering on service trolleys: rice dish, curries and desserts. There are no plated dishes, menu cards or prices.
- **No footage of the Restaurant floor or the Rooftop BBQ seating was identified.** I could not tell whether the dining tables seen belong to the hall or the restaurant, so they are labelled "dining setup", not "restaurant".

## 1. Complete inventory

| Original | Type | Dims | Content | Verdict |
|---|---|---|---|---|
| WhatsApp Image … 23.00.59.jpeg | Photo (**phone screenshot**) | 573×1280 | Night facade with all signs lit, paved forecourt | Unsuitable as-is: status bar and navigation bar baked in, low resolution → `05_unsuitable/` |
| … 23.01.06.jpeg | Photo | 1280×851 | Lobby: marble floor, chandeliers, florals, staircase | **Selected** |
| … 23.01.07.jpeg | Photo | 1079×712 | Hall aisle, sofa rows, central chandelier, stage at end | **Selected (best landscape)** |
| … 23.01.08.jpeg | Photo | 1079×712 | Floral stage, green arches, teal sofas | **Selected** |
| … 23.01.09.jpeg | Photo | 1079×682 | Row of lit chandeliers, planters (slightly soft) | Selected (secondary) |
| … 23.01.13.jpeg | Photo | 1079×712 | Wide hall: dining tables + lounge, stair rail | **Selected** |
| … 23.01.15.jpeg | Photo | — | **Exact duplicate** of 23.01.08 | Not used |
| … 23.01.16.jpeg | Photo | — | **Exact duplicate** of 23.01.07 | Not used |
| … 23.01.17.jpeg | Photo | — | **Exact duplicate** of 23.01.09 | Not used |
| … 23.01.17 (1).jpeg | Photo | 1079×717 | Long crystal chandelier over dining chairs | **Selected** |
| WhatsApp Video … 23.01.06 (1).mp4 | Video 40.2 s, 576×1024, 30 fps, 9:16, audio | — | **Promotional venue tour.** 0–1 s presenter with "WELL COME TO SABOR CON AMOR" text overlay; 2–4 s drone exterior (one frame shows a "Coming Soon" banner); 5–6 s pole sign at night; 7–9 s horse sculpture; 10–11 s table setting; 13–14 s hall aisle; 15–16 s floral stage; 18–19 s ceiling; 20–24 s lounge and dining; 25–26 s stairwell painting; 28–31 s wide hall; 33–37 s drone dusk exterior; 38–40 s pole sign at dusk. Transitions at ~12, 17, 27, 32 s are blurred. | Frames extracted |
| WhatsApp Video … 23.01.06.mp4 | Video 49.8 s, 576×1024, 30 fps, 9:16, audio | — | **Real event footage.** 0–1 s street exterior at dusk; 2–3 s parking; 4 s white flash; 5–16 s wedding arrival with band and guests; 17 s blur; 18–40 s food service trolleys, "Sabor Con Amor" gold logo wall, guests dining; 41–42 s daytime facade; 43–48 s drone with road; 48–49 s fade to dark | Frames extracted (privacy limits apply) |

## 2. Extracted frames (source → frame mapping)

Method: within each reviewed shot window, ffmpeg `blurdetect` scored every frame, the sharpest was exported losslessly (PNG, native 576×1024), and the result was checked by eye. Six first-pass picks were rejected (flash frame, fades, cut boundaries) and re-picked.

| Frame file (`03_video_frames/…`) | Source | Time | Recommended section |
|---|---|---|---|
| exterior/tour_exterior-drone-dusk-b_t036s20 | Tour | 36.20 s | **Hero poster**, About |
| exterior/tour_exterior-drone-dusk-a_t033s63 | Tour | 33.63 s | About, Rooftop BBQ teaser (roof sign only) |
| exterior/tour_exterior-drone-approach_t003s57 | Tour | 3.57 s | Gallery, About |
| exterior/event_exterior-street-dusk_t000s53 | Event | 0.53 s | Location |
| exterior/event_exterior-ground-day_t041s53 | Event | 41.53 s | Location, About (vehicle plates visible) |
| exterior/event_exterior-drone-road-a_t044s53 | Event | 44.53 s | Location / directions |
| exterior/event_exterior-drone-road-b_t047s87 | Event | 47.87 s | Location / directions |
| signage/tour_signage-pole-night_t005s40 | Tour | 5.40 s | Location, brand |
| signage/tour_signage-pole-dusk_t038s97 | Tour | 38.97 s | Location (sign shows a phone number; confirm it before use) |
| banquet-hall/tour_hall-aisle-chandeliers_t014s63 | Tour | 14.63 s | Facilities: Banquet Hall (mobile) |
| banquet-hall/tour_hall-wide-a_t029s90 | Tour | 29.90 s | Facilities, Gallery |
| banquet-hall/tour_hall-wide-b_t030s93 | Tour | 30.93 s | Facilities, Gallery |
| banquet-hall/tour_lounge-sofa-seating_t020s47 | Tour | 20.47 s | Facilities, Gallery |
| dining-setup/tour_dining-table-setting-a_t010s47 | Tour | 10.47 s | Menus intro, Gallery |
| dining-setup/tour_dining-table-setting-b_t023s73 | Tour | 23.73 s | Menus intro, Gallery |
| stage-and-decor/tour_stage-floral-teal_t016s70 | Tour | 16.70 s | Stage & lighting (mobile) |
| stage-and-decor/tour_ceiling-chandelier_t018s47 | Tour | 18.47 s | Stage & lighting |
| stage-and-decor/tour_decor-horse-sculpture_t008s53 | Tour | 8.53 s | Event decorations |
| interior/tour_stairwell-painting_t026s60 | Tour | 26.60 s | Gallery (secondary; warm colour cast) |
| food-service/event_food-desserts-logo-wall_t034s33 | Event | 34.33 s | **Menus & catering (signature shot)** |
| food-service/event_food-rice-trolley_t024s00 | Event | 24.00 s | Menus & catering (staff faces visible) |
| food-service/event_food-curry-bowls_t036s00 | Event | 36.00 s | Menus & catering |
| food-service/event_food-curry-trolley-hall_t039s90 | Event | 39.90 s | Menus & catering (staff faces visible) |
| food-service/event_hall-service-trolleys_t021s40 | Event | 21.40 s | Menus & catering, Gallery (staff visible) |
| NOT-RECOMMENDED/event_hall-guests-wide_t029s87 | Event | 29.87 s | **Do not publish**: dark frame, identifiable guests |

**Deliberately not extracted:** the presenter intro (identifiable person plus burnt-in text), the wedding arrival and band sequence (identifiable guests, the groom's party and children), the guests-dining shots, the parking shot (number plates), and every transition, flash and fade frame.

## 3. Asset-to-page mapping

| Page / section | Primary | Alternates |
|---|---|---|
| Homepage hero | **Video:** tour drone dusk segment **33.5–37.9 s** as a muted loop, poster `tour_exterior-drone-dusk-b` | Desktop still: `hall_sofa-aisle-central-chandelier.jpg` (only true landscape hall shot) |
| About / venue intro | `lobby_marble-floral-chandeliers.jpg` | `event_exterior-ground-day`, `tour_exterior-drone-dusk-a` |
| Facilities: Banquet Hall | `hall_wide-dining-and-lounge.jpg`, `hall_sofa-aisle-central-chandelier.jpg` | tour hall frames |
| Facilities: Restaurant / Rooftop BBQ | **No suitable media** (signage only) | — |
| Menus & food | `event_food-desserts-logo-wall` | other food-service frames |
| Gallery | All selected photos + frames | — |
| Event decorations | `stage_floral-arches-teal-sofas.jpg`, horse sculpture | `tour_stage-floral-teal` |
| Stage & lighting | `hall_crystal-chandelier-dining-chairs.jpg`, `tour_ceiling-chandelier` | `hall_chandelier-row-planters-night.jpg` |
| Location / contact | `event_exterior-drone-road-b`, `tour_signage-pole-night` | street / road frames |
| Auth screens (side image) | `hall_sofa-aisle-central-chandelier.jpg` | `lobby_marble-floral-chandeliers.jpg` |

`04_website_ready/` holds the selected photos as-is (already web-sized JPEG, not re-encoded) and the frames as high-quality JPEG (q2) at native size. No cropping or retouching was done; crops are a Phase 4 layout task.

## 4. Quality limits

- Every source has been through WhatsApp compression. The videos are **576×1024 portrait** and the photos are about **1080–1280 px wide**.
- They work for mobile, cards and gallery thumbnails. They are **too small for a sharp full-width desktop hero**, which would need about 2.5× upscaling.
- There is no landscape exterior or drone footage, which the design's wide desktop hero needs.

## 5. Missing media requirements

1. **Original, uncompressed** photos and videos, ideally the drone and tour originals at 1080p/4K, in **landscape** for desktop.
2. The original of the night facade (23.00.59 is only a phone screenshot).
3. Restaurant: dining room, tables and ambience.
4. Rooftop BBQ: seating, grill and night view.
5. Plated food and menu items, with names, plus the menu cards if any exist.
6. Logo files: vector or high-res PNG of the round "SA" emblem and the wordmark. Also a favicon.
7. Real event setups with consent (stage themes, mehndi, walima, corporate), if the site will show event categories.
8. Any other halls or spaces, with capacities.
9. Bridal room, parking and prayer area (only if they exist; none is claimed here).
10. **Consent or releases** for any identifiable guests or staff before event-footage frames are published.
