# 01 — Brand Identity & Design System

Taken from the two mockups. Hex values were sampled from the images, then rounded to a clean palette. Confirm them against the source design file, if one exists, before launch.

## 1. Brand personality

| Attribute | Expression in the UI |
|---|---|
| **Premium / collector-grade** | Near-black canvas, generous whitespace, product shots lit dramatically against darkness |
| **Bold, comic-energy** | Condensed uppercase headings, single hot accent (amber-orange), strong CTAs |
| **Trustworthy** | Repeated trust strips (secure shipping, collector packaging, pull list), grade badges, reviews |
| **Curated, not cluttered** | One accent color, thin hairline borders, consistent card grid |

Tagline system:
- Primary: **"Collect More. Discover Original."**
- Eyebrow: **"COMIC BOOKS & COLLECTIBLES FOR TRUE COLLECTORS."**
- Secondary: **"Collect Beyond The Page"** (collectibles promo)

## 2. Logo

- **Mark:** a circle outline (off-white) with an amber right-triangle "cape fold" inside, filling the lower-right quadrant.
- **Wordmark:** `caps` / `&capes`, lowercase, on two lines, in a rounded geometric sans, off-white.
- **Lockups needed:** horizontal (header), mark-only (footer newsletter, favicon, social avatar), mono white, mono black.
- **Deliverables:** SVG (theme `assets/logo.svg`, inlined for crisp rendering), 32/180/512 px PNG favicons, OG share image 1200×630.
- **Clear space:** at least the height of the triangle on all sides. Minimum width in the header is 160 px desktop and 120 px mobile.

> Action: get the vector logo from the designer. Do not trace it from the PNG mockup.

## 3. Color palette

### Core tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#050607` | Page background (true near-black, slight blue-green tint) |
| `--color-surface` | `#0D0E0F` | Cards, tiles, panels |
| `--color-surface-raised` | `#141516` | Hover state of cards, inputs, dropdown menus |
| `--color-border` | `#2A2A2A` | 1 px hairline borders on cards, tabs, inputs |
| `--color-border-strong` | `#3A3836` | Panel borders (grade badge panel, trust strip) |
| `--color-text` | `#F2EEE8` | Primary text (warm off-white) |
| `--color-heading` | `#E6DCCB` | Hero display headline (warm cream/parchment) |
| `--color-text-muted` | `#B9B3A7` | Body copy, meta lines ("Caps & Capes Comics • 2024") |
| `--color-text-subtle` | `#8A857C` | Captions, legal, placeholder text |
| `--color-accent` | `#F7A21B` | Brand amber: primary buttons, prices, links, eyebrows, active tab, cart bubble |
| `--color-accent-hover` | `#FFB52E` | Hover on primary buttons and links |
| `--color-accent-press` | `#E08A00` | Pressed / active state |
| `--color-on-accent` | `#0A0A0A` | Text on amber buttons |
| `--color-star` | `#F7A21B` | Review stars (same as accent) |
| `--color-focus` | `#FFD27A` | Keyboard focus ring (2 px outline + 2 px offset) |

### Supporting / semantic

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#3FB27F` | In stock, form success |
| `--color-warning` | `#F7A21B` | Low stock (reuses accent) |
| `--color-error` | `#E5484D` | Form errors, sold out label |
| `--color-preorder` | `#8B5CF6` | Preorder badge (echoes the purple Voidwalker art; use sparingly) |

### Atmosphere

The hero and promo banners use **radial vignette lighting**: a warm amber glow behind products that fades into black. Implement it as a layered background on the section:

```css
background:
  radial-gradient(60% 70% at 70% 45%, rgba(247,162,27,.18) 0%, rgba(247,162,27,0) 60%),
  radial-gradient(40% 50% at 85% 60%, rgba(120,70,200,.10) 0%, transparent 70%),
  var(--color-bg);
```

Keep the glow intensity as a section setting (0–30%) so merchants can tune it per image.

### Contrast check (WCAG 2.2)

| Pair | Ratio (approx.) | Result |
|---|---|---|
| `#F2EEE8` on `#050607` | ~18:1 | AAA |
| `#B9B3A7` on `#050607` | ~10:1 | AAA |
| `#8A857C` on `#050607` | ~5.4:1 | AA (keep it for ≥14 px text) |
| `#0A0A0A` on `#F7A21B` | ~10:1 | AAA |
| `#F7A21B` on `#050607` | ~10:1 | AAA |

## 4. Typography

The mockups use three type voices. Use these open-license fonts, self-hosted as WOFF2 in `assets/`:

| Role | Recommended font | Weight(s) | Where it appears | Alternatives |
|---|---|---|---|---|
| **Display** | **Outfit** | 600 | Hero "Collect More. Discover Original.", PDP product title | Sora, Lexend |
| **Condensed UI / headings** | **Barlow Condensed** | 500, 600, 700 | Nav links, section titles ("FEATURED THIS WEEK"), buttons, eyebrows, card titles, tabs | Oswald, Roboto Condensed |
| **Body** | **Inter** | 400, 500 | Paragraphs, spec tables, descriptions, footer links | Shopify system stack fallback |

> Comic cover title fonts (Cinzel-like serifs on "Aurora Knights") are part of the **product artwork**, not the UI. Do not use them in the theme.

### Type scale (desktop → mobile)

| Token | Font | Desktop | Mobile | Line height | Tracking | Case |
|---|---|---|---|---|---|---|
| `--text-display` | Outfit 600 | 64 px | 40 px | 1.05 | -0.01em | Sentence |
| `--text-h1` (PDP title) | Outfit 600 | 40 px | 28 px | 1.15 | 0 | Title |
| `--text-h2` (section title) | Barlow Cond. 600 | 26 px | 22 px | 1.1 | 0.02em | UPPER |
| `--text-h3` (card / tile title) | Barlow Cond. 600 | 16 px | 15 px | 1.25 | 0.04em | UPPER |
| `--text-eyebrow` | Barlow Cond. 600 | 18 px | 14 px | 1.2 | 0.06em | UPPER, accent |
| `--text-nav` | Barlow Cond. 600 | 15 px | — | 1 | 0.04em | UPPER |
| `--text-button` | Barlow Cond. 600 | 16 px | 15 px | 1 | 0.06em | UPPER |
| `--text-price-lg` | Barlow Cond. 700 | 28 px | 24 px | 1 | 0.01em | — accent |
| `--text-price` | Barlow Cond. 600 | 18 px | 16 px | 1 | 0.01em | — |
| `--text-body-lg` | Inter 400 | 18 px | 16 px | 1.6 | 0 | — |
| `--text-body` | Inter 400 | 15 px | 15 px | 1.6 | 0 | — |
| `--text-small` | Inter 400 | 13 px | 13 px | 1.5 | 0 | — |

## 5. Spacing, radius, elevation, layout

- **Spacing scale (4 px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Radius:** `--radius-sm: 2px` (buttons, inputs, qty stepper), `--radius-md: 4px` (cards, panels). The look is **sharp**, not pill-shaped. The carousel arrows are the only circles.
- **Borders:** 1 px `--color-border`. Elements show their edges with borders, not shadows.
- **Shadows:** almost none. Product imagery carries the depth. Use `0 8px 24px rgba(0,0,0,.5)` only for the dropdown menu and the cart drawer.
- **Container:** max-width 1400 px, side gutters 32 px desktop, 16 px mobile.
- **Grid:** 12 columns, 24 px gap desktop, 16 px mobile.
- **Breakpoints:** `sm 480`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1440`.

## 6. Iconography

- **Style:** outline, 1.5 px stroke, square-ish line caps, off-white. Accent-colored versions are used in trust strips (box, calendar-check, return arrow, shield-check).
- **Set:** use **Lucide** (MIT) as the base and export the icons used to inline SVG snippets (`snippets/icon-*.liquid`).
- **Required icons:** search, user, cart, chevron-down/right/left/up, arrow-left/right (carousel), plus, minus, heart, zoom-in, star (filled/half/empty), shield-check, package/box, calendar-check, rotate-ccw (returns), shipping box, and social icons (Facebook, Instagram, X, YouTube, TikTok).
- Payment icons come from Shopify (`shop.enabled_payment_types` + `payment_type_svg_tag`). Do not hand-draw them.

## 7. Component inventory (visual spec)

| Component | Spec |
|---|---|
| **Button – primary** | Amber fill, `#0A0A0A` text, Barlow Cond. 600 UPPER, 48 px tall (PDP 52 px), 24–32 px horizontal padding, 2 px radius. Hover: `--color-accent-hover`. |
| **Button – secondary** | Transparent, 1.5 px amber border, amber text. Hover: 10% amber fill. ("Browse Collectibles", "Add to Cart" on PDP) |
| **Button – tertiary** | Transparent, 1 px off-white border, off-white text ("Save to Wishlist") |
| **Button – small outline** | 32 px tall, 1 px amber border, amber text, 12 px text ("ADD TO CART" on cards) |
| **Text link CTA** | Amber, UPPER, condensed, with a trailing chevron ("SHOP NOW ›") |
| **Category tile** | Surface card, 1 px border, image left (≈45%), text right: H3 title, muted 2-line description, text-link CTA |
| **Product card (horizontal)** | Surface card, image left (cover/slab art), right column: UPPER title split over lines, price (condensed, off-white), small outline "Add to cart" |
| **Product card (vertical)** | Used in "You may also like" and collection grids: image top with dark spotlight bg, title UPPER 2 lines, price in amber |
| **Carousel controls** | 32 px circles, 1 px border; prev is muted, next is amber-bordered when enabled. "View all" text link sits to their left. |
| **Section heading** | H2 UPPER condensed + a 1 px hairline rule that fills the rest of the row |
| **Publisher logo tile** | Square surface tile, mono off-white logo SVG, hover lifts it to the accent color |
| **Trust item** | Accent outline icon (32 px) + condensed UPPER title + muted small caption |
| **Grade badge panel** | Bordered panel: shield icon, amber "CGC 9.8 WHITE PAGES", white "Top Tier Grade", muted caption, underlined amber "View CGC Census" link |
| **Spec table** | 2 columns, label in white 500, value in muted, 12 px row gap, no table borders |
| **Quantity stepper** | 1 px bordered box with – / value / +, 40 px tall |
| **Tabs** | UPPER condensed. Active tab is amber with a 2 px amber underline, inactive tabs are off-white. A 1 px hairline runs under the full tab row. |
| **Badge – cart count** | 18 px amber circle, black 11 px bold number, top-right of the cart icon |
| **Breadcrumb** | Inter 13 px muted, `›` separators, current page in off-white |
| **Input** | Transparent / surface fill, 1 px border, 44 px tall, placeholder in subtle color. Focus: amber border. |
| **Stars** | 5 × 16 px filled amber stars, "5.0 (27 reviews)" muted |

## 8. Imagery guidelines

- **Product photography:** shoot on black with a single warm key light from top-left and a subtle rim light. Slabs should be shot at a slight 3/4 angle to match the PDP hero.
- **Format:** source at least 2048 px on the long edge. The theme serves sizes via `image_url: width:` with `srcset`.
- **Card images:** use a consistent aspect ratio per type. Comics and slabs: portrait 2:3 (slab art: 0.68 ratio). Statues and figures: 4:5. Use `object-fit: contain` on the dark spotlight background, so slab edges are never cropped.
- **Hero & promo art:** these are composed marketing images (transparent PNG/WebP products layered over the CSS glow). Supply them as 2 assets: one desktop (2400×1000) and one mobile (1200×1400).
- **IP caution:** the mockup art (Eclipse Chronicles, Aurora Knights, etc.) is placeholder. Real listings will show real covers and real grading-company labels, which is normal resale practice. Brand marketing assets should use original or licensed art.

## 9. Voice & copy

- Short, confident, collector vocabulary: *key issue, first appearance, slab, pull list, white pages, census*.
- Section titles are UPPERCASE, 2–4 words.
- CTAs start with a verb: *Shop now, Browse collectibles, Add to cart, Buy it now, Save to wishlist, Sign up*.
- Microcopy reassures the buyer: *"Carefully packed. Fully insured."*, *"Bagged, boarded & boxed with care."*
