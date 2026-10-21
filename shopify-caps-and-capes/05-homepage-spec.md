# 05 — Homepage Spec

> **Update — cards:** the homepage section order now mixes comics and cards: a showcase hero carousel, topic tiles with availability counts, a mixed Featured carousel with department tabs, split showcases, a "Shop the inventory" availability matrix and a cross-category graded Vault. See [10-cards-topics-and-showcases.md](10-cards-topics-and-showcases.md).

Reference: [`mockups/01-homepage.png`](mockups/01-homepage.png). Measurements are relative to a 1440 px wide desktop viewport.

## Layout overview

```
┌──────────────────────────────── HEADER (sticky) ────────────────────────────────┐
│ logo │ NEW THIS WEEK  COMICS▾ KEY ISSUES GRADED COMICS COLLECTIBLES▾ ACTION…▾ … │ search │ acct │ cart(2)
├──────────────────────────────── HERO (split) ───────────────────────────────────┤
│ Display headline / eyebrow / body / [primary] [secondary]  │  product composition │
├──────── CATEGORY TILES (5 across) ──────────────────────────────────────────────┤
├──────── FEATURED THIS WEEK (horizontal-card carousel, 6 visible) ───────────────┤
├── SHOP BY PUBLISHER (6 logos) ──┬── PROMO BANNER ───────────┬── TRUST LIST (3) ─┤
├──────── FOOTER (newsletter │ Shop │ Customer Care │ About │ Follow us/payments) ──┤
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Header — `sections/header.liquid`

| Element | Spec |
|---|---|
| Height | ~76 px, background `--color-bg`, 1 px bottom hairline |
| Logo | Left, ~165 px wide, links to `/` |
| Nav | 8 items, Barlow Cond. 600 15 px UPPER, 0.04em tracking, 28 px gap. Chevron icon for dropdown items. Hover: amber text. Active collection: amber underline 2 px. |
| Search | Fixed ~270 px width, 40 px tall, 1 px border, placeholder in subtle color, search icon at right. Grows on focus to 360 px if there's room. |
| Account / Cart | Icon (24 px) stacked over a 12 px label. Cart has an amber count bubble. |
| Settings | `logo` (image), `logo_width`, `menu` (link_list), `show_search`, `sticky` (bool), mega-menu blocks: `promo_tile` (image, heading, link, parent menu item title) |

**Responsive:** below 1280 px, shrink nav gap to 18 px and hide the "Account"/"Cart" labels. Below 1024 px, use the hamburger layout (doc 03 §1).

## 2. Hero — `sections/hero-split.liquid`

| Element | Spec |
|---|---|
| Height | ~420 px content area (min-height 520 px incl. padding) |
| Left column (≈40%) | Display headline (2 lines, `--color-heading`), eyebrow (amber UPPER), body-lg muted (max 46ch), button row (primary + secondary, 16 px gap) |
| Right column (≈60%) | One composed image (transparent WebP), bottom-aligned, overflowing into the tile row by ~20 px for depth |
| Background | `--color-bg` + amber radial glow behind the image (setting: `glow_strength`) |
| Settings | `heading` (inline_richtext, supports `<br>`), `eyebrow`, `text`, `button_1_label/link`, `button_2_label/link`, `image_desktop`, `image_mobile`, `glow_strength` (range 0–30), `text_width` |
| Mobile | Stack: image first (cropped composition, `image_mobile`), then text. Headline 40 px, buttons full width. |
| Perf | Image `loading="eager" fetchpriority="high"`, preload in `<head>` via `content_for_header`-safe `<link rel="preload" as="image" imagesrcset=…>` |

## 3. Category tiles — `sections/category-tiles.liquid`

| Element | Spec |
|---|---|
| Layout | 5 equal tiles in a row, 16 px gap, each ~110 px tall |
| Tile | Surface bg, 1 px border, 4 px radius. Image left (cropped product art, ~40% width, bleeds to the top/left edges), right: title H3 UPPER, 2-line muted caption, "SHOP NOW ›" amber |
| Hover | Border turns amber 40% and the image scales 1.04 (respect reduced motion) |
| Blocks | `tile`: `image`, `title`, `caption`, `link_label`, `collection` (or `url`). Max 6 blocks. |
| Mobile | Horizontal scroll-snap row with 1.3 tiles visible, **or** a 2-col grid (decide in QA; recommended: scroll row) |

## 4. Featured this week — `sections/product-carousel.liquid`

| Element | Spec |
|---|---|
| Heading row | "FEATURED THIS WEEK" H2 + hairline, then "View all" link + prev/next circular arrows on the right |
| Source | `collection` setting (default `featured-this-week`), `products_to_show` (4–16, default 12) |
| Card | **Horizontal product card**: ~225 × 155 px. Image left (contain, spotlight bg), right: title UPPER split across lines (series / `#1`), price (condensed 18 px off-white), "ADD TO CART" small outline button |
| Visible | 6 at 1440, 4 at 1024, 2.2 (peek) on mobile |
| Behaviour | Scroll-snap. Arrows move by one page. Disable the prev arrow at the start. Quick add uses the drawer. For multi-variant products, the button reads "CHOOSE OPTIONS" and links to the PDP. Sold out → disabled "SOLD OUT". Preorder → "PREORDER". |
| Graded items | Card image shows the slab. Optional small grade chip ("9.8") overlay if the image doesn't show the label clearly (setting). |

## 5. Shop by publisher — `sections/publisher-logos.liquid`

| Element | Spec |
|---|---|
| Container | Bordered surface panel ~600 px wide (≈42% of the row) with H2 "SHOP BY PUBLISHER" and a "View all" link → `/pages/publishers` |
| Tiles | 6 square-ish tiles (~88 × 78 px), surface-raised bg, mono off-white SVG logo + name |
| Source | Metaobjects `publisher` where `featured = true`, sorted by `sort_order` (Liquid: `shop.metaobjects.publisher.values`, then filter/sort) **or** blocks with a metaobject picker for manual control |
| Link | Publisher metaobject web page (`publisher.system.url`) |
| Mobile | 3×2 grid |

## 6. Promo banner — `sections/promo-banner.liquid`

| Element | Spec |
|---|---|
| Size | ≈36% of the row, ~140 px tall, 1 px border |
| Content | Background image (figures at left/right edges), centred: heading "COLLECT BEYOND THE PAGE" (Barlow Cond. 700, 28 px, amber), subheading "PREMIUM STATUES, FIGURES & MORE" (off-white UPPER), primary button "SHOP COLLECTIBLES" |
| Settings | `image`, `image_mobile`, `heading`, `subheading`, `button_label`, `button_link`, `overlay_opacity` |
| Mobile | Full width, 280 px tall, centred content, image overlay at 50% |

## 7. Trust list — `sections/trust-list.liquid`

| Element | Spec |
|---|---|
| Container | Bordered panel ≈22% of the row |
| Items | 3 rows: amber outline icon (32 px) + UPPER title + muted caption |
| Source | `trust_point` metaobjects (shared with PDP), or blocks |
| Copy | SECURE SHIPPING — Carefully packed. Fully insured. / PULL LIST FRIENDLY — Add issues to your pull list. / COLLECTOR PACKAGING — Bagged, boarded & boxed with care. |

> Sections 5–7 sit in one row on desktop (≈ 42/36/22 split). Implement this as a `row` section with three nested **theme blocks** (`publisher-logos`, `promo-banner`, `trust-list`) and a `column_ratio` setting. On < 1024 px the row stacks.

## 8. Footer — `sections/footer-newsletter.liquid` + `sections/footer.liquid`

| Element | Spec |
|---|---|
| Newsletter | Large logo mark (64 px), "STAY IN THE LOOP" H2, muted caption, inline email input (~230 px) + amber "SIGN UP" button. Uses `{% form 'customer' %}` with `contact[tags]=newsletter`. Success message inline. |
| Columns | SHOP · CUSTOMER CARE · ABOUT. Headings: condensed UPPER 14 px off-white. Links: Inter 13 px muted, hover amber. |
| Follow us | 5 circular outline social icons (32 px) |
| We accept | Payment icons row (`shop.enabled_payment_types`) |
| Legal | © year left. Privacy / Terms right. 12 px subtle. |
| Mobile | Newsletter first, then columns as accordions, then social, payments and legal centred |

## Homepage acceptance criteria

1. At a 1440 px viewport, the page matches the mockup within ±4 px spacing and the exact token colors and fonts. Verified by an overlay diff (PerfectPixel or a Playwright screenshot diff against the mockup).
2. A merchant can reorder, hide and edit every section and its copy in the theme editor.
3. Quick add from the carousel updates the cart badge and opens the drawer without a page reload.
4. Lighthouse mobile performance ≥ 85, accessibility ≥ 95.
5. Keyboard users can operate the nav, mega menus, search, carousel and newsletter.
