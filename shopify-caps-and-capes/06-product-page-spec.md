# 06 — Product Page Spec

Reference: [`mockups/02-product-graded-comic.png`](mockups/02-product-graded-comic.png) (graded comic). One section system serves three templates. Blocks switch on and off by product type.

| Template | Used for | Differences from mockup |
|---|---|---|
| `product.graded.json` | Graded Comic | Exactly as mocked |
| `product.comic.json` | Raw Comic | No grade badge panel. Variant picker (cover / condition). Quantity stepper enabled. The tab "CGC Information" becomes "Issue Info". |
| `product.collectible.json` | Collectible, Action Figure | Spec table shows manufacturer, scale, material, dimensions, edition size. Badge panel shows "Limited Edition 500" or is hidden. Tab "What's in the box". |

Assign templates automatically in the import script by `product_type`.

## 1. Page layout (desktop 1440)

```
breadcrumb: Home › Graded Comics › Aurora Knights › Aurora Knights #1 CGC 9.8
┌thumbs┐┌──── main image ────┐  ┌──────── info column ─────────────────────┐
│  ▲   ││                    │  │ H1 title                                 │
│ [1]  ││   slab hero image  │  │ Publisher • Year                         │
│ [2]  ││                    │  │ ★★★★★ 5.0 (27 reviews)                   │
│ [3]  ││               (🔍) │  │ $89.99                                   │
│ [4]  │└────────────────────┘  │ short description                        │
│  ▼   │                        │ ──────────────────────────────────────── │
└──────┘                        │ spec table           │ grade badge panel │
                                │ Quantity [-1+]       [♡ SAVE TO WISHLIST]│
                                │ [ ADD TO CART ]      [   BUY IT NOW    ] │
                                │ trust strip (3)                          │
┌──── tabs: DESCRIPTION | KEY DETAILS | SHIPPING & RETURNS | CGC INFO ┐ ┌ YOU MAY ALSO LIKE (4) ┐
└─────────────────────────────────────────────────────────────────────┘ └────────────────────────┘
```

- Grid: gallery (thumb rail ~105 px + main ~545 px) ≈ 47% | info ≈ 53%, 48 px gap.
- Bottom row: tabs ≈ 43% | recommendations ≈ 52%, side by side on desktop (unusual but mocked). Below 1280 px, stack them full width.

## 2. Blocks of `main-product.liquid`

| Block | Data source | Spec |
|---|---|---|
| **breadcrumbs** | `collection` context, else the product's primary collection (`product.metafields.custom.primary_collection`), then series (`comic.issue.series`) | Inter 13 px muted |
| **gallery** | `product.media` | Vertical thumb rail with up/down chevrons (5 visible, 96 × 110 px, active = 2 px amber border). Main image on a dark spotlight surface with 1 px border. Zoom button bottom-right (circle, 40 px) opens a lightbox. Supports video and 3D media. Mobile: swipeable main image + dot indicators, thumbs hidden. |
| **title** | `product.title` | Outfit 600 40 px off-white |
| **meta_line** | `custom.publisher.name` • year of `custom.release_date` | Muted 16 px, amber dot separator |
| **rating** | `product.metafields.reviews.rating` / `rating_count` | 5 stars + "5.0 (27 reviews)", click scrolls to the reviews widget |
| **price** | `product.selected_or_first_available_variant.price`, `compare_at_price` | Amber 28 px condensed bold. A sale shows the compare-at price struck through in muted. Unit price/tax note via locale. |
| **excerpt** | `product.metafields.custom.excerpt` (fallback: first paragraph of the description, truncated) | Body-lg muted, max 65ch |
| **divider** | — | 1 px hairline |
| **spec_table** | Rows defined as blocks-within-block or fixed by template: Condition/Grade (`grading.company.name` + `grading.grade` + `grading.page_quality`), Publisher, Release Date (`custom.release_date \| date: '%B %-d, %Y'`), Page Count (`comic.issue.page_count`), UPC (`comic.issue.upc` or `variant.barcode`) | Label 500 off-white, value muted. A row is hidden when its value is blank. |
| **grade_badge** | `grading.*` + `grading.company` metaobject | Panel: shield icon, "{{company}} {{grade}} {{page_quality \| upcase}}" amber, `grade_label` white, caption "Professionally graded and encapsulated by {{company}}.", link "View {{company}} Census" → `company.census_url_template` with cert/title substituted. Hidden when `grading.grade` is blank. |
| **variant_picker** | `product.options_with_values` | Raw comics/collectibles only. Pill buttons with 1 px border, amber when selected. Updates the `?variant=` URL param and re-renders price/availability via the Section Rendering API. |
| **quantity** | — | Label "Quantity:" + stepper. Max = inventory. Hidden when inventory max = 1 (slabs show "1 of 1 available" instead). |
| **wishlist** | Wishlist app | Tertiary button "♡ SAVE TO WISHLIST", toggles to "♥ SAVED". Logged-out users get a guest list or login prompt (per app). |
| **buy_buttons** | `{% form 'product' %}` | "ADD TO CART" secondary (amber outline, cart icon) + "BUY IT NOW" primary (amber fill). See §3. |
| **trust_strip** | `trust_point` metaobjects (PDP set: Secure Shipping, Easy Returns, Pull List Ready) | Bordered panel, 3 columns, icon + UPPER title + 2-line muted caption |

### Availability states (button labels)

| State | Add to cart | Buy it now | Extra |
|---|---|---|---|
| In stock | ADD TO CART | BUY IT NOW | — |
| Last one (slab) | ADD TO CART | BUY IT NOW | "Only 1 available — unique slab" note |
| Sold out | SOLD OUT (disabled) | hidden | "Notify me when back" (back-in-stock app) |
| Preorder | PREORDER NOW | hidden | Release date chip, preorder terms (deposit/charge timing), selling-plan radio if multiple plans |

## 3. "Buy it now" styling

Shopify's `{{ form | payment_button }}` dynamic checkout button renders as an iframe or accelerated-checkout button (Shop Pay, Apple Pay, etc.), and its styling is limited. To match the mockup:

- **Option A (recommended):** a custom amber `BUY IT NOW` button (`<buy-now-button>`) that adds the variant via AJAX and redirects to `/checkout`. Show a small row of accelerated checkout buttons (Shop Pay) inside the cart drawer, where they're conventional.
- **Option B:** keep `payment_button` and style it as far as Shopify allows (`shopify-payment-button__button--unbranded`). Accept that branded wallets render their own colors.

Option A gives a pixel-exact match. It trades away some one-tap wallet conversion on the PDP. Revisit after launch with A/B data.

## 4. Product tabs — `sections/product-tabs.liquid`

| Tab | Content source |
|---|---|
| DESCRIPTION | `product.description` + `comic.highlights` as an amber-bulleted list ("First issue in the Aurora Knights ongoing series", "Striking debut cover by Kael Morwen"…) |
| KEY DETAILS | `comic.issue.is_key` → "Key Issue" badge + `key_notes`. Writers / artists / cover artist (creator metaobjects linked). Series link. Cover label. Print run. |
| SHIPPING & RETURNS | Rich text from a shared `page` (`pages['shipping-returns-summary']`) + links to `/policies/shipping-policy` and `/policies/refund-policy` |
| CGC INFORMATION | Label = "{{ grading.company.name }} INFORMATION". Body = `grading.company.about` + cert number + "Verify certification" link (`cert_lookup_url_template`). Graded template only. |

Style: tabs as in doc 01. Content area body-15 muted, 24 px padding, bordered panel. Below 768 px, the tabs become accordions (first one open).

## 5. You may also like — `sections/product-recommendations.liquid`

- Data: **Product Recommendations API** (`/recommendations/products?product_id=…&section_id=…&intent=related&limit=4`). Fetch it lazily on scroll into view.
- Merchant override: Search & Discovery app "related" and "complementary" product settings.
- Fallback when the API returns fewer than 4: same `custom.publisher` or the same collection.
- Card: **vertical product card**: spotlight image (slab), title UPPER 2 lines, price amber. Heading row with "View all" and arrows like the homepage carousel.

## 6. Below the fold (not in mockup, recommended)

1. **Reviews widget** (reviews app), styled with theme tokens.
2. **Other copies of this issue** (`issue-copies` section): products whose `comic.issue` equals this product's issue. Query by a Flow-maintained tag `issue:{handle}` or a collection per issue, since Liquid can't run arbitrary queries.
3. **Recently viewed** (localStorage, client-rendered via the Section Rendering API).

## 7. SEO & structured data

- `Product` JSON-LD with `offers` (price, availability, `itemCondition`: `UsedCondition` for graded/back issues, `NewCondition` for new releases), `brand` = publisher, `aggregateRating` from reviews, `gtin12` = UPC, `sku`.
- Title tag pattern: `{{ product.title }} | {{ grading.company }} Graded Comic | Caps & Capes`.
- Canonical stays on `/products/{handle}` (no collection-scoped canonicals).
- Image alt: "{{ title }} — front of {{ company }} slab" (set via the import script).

## 8. Analytics events

`view_item`, `add_to_cart`, `begin_checkout` (buy now), `add_to_wishlist`, `view_item_list` (recommendations). Use Shopify **Customer Events / Web Pixels** (no hard-coded GA tags in the theme).

## PDP acceptance criteria

1. At 1440 px, matches the mockup within ±4 px with exact tokens.
2. The grade badge, spec rows and CGC tab render only from metafields. A raw comic shows none of the grading UI.
3. A slab cannot be added at quantity > 1. A second add shows "Only 1 available".
4. Buy it now goes to checkout with exactly that item, in under 1.5 s on desktop broadband.
5. Structured data passes Google's Rich Results Test.
6. Gallery, tabs and the quantity stepper are fully keyboard accessible.
