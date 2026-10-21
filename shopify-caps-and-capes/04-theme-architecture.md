# 04 — Theme Architecture

## 1. Build strategy decision

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Buy a premium theme and re-skin it | Fast start | Fights the theme's own design. A pixel-exact match means overriding a lot of CSS. Upgrades break. Carries code bloat. | ✗ |
| Fork **Dawn / Horizon** | Mature, accessible, OS 2.0 | Large codebase whose look differs from ours. We'd delete more than we keep. | Possible fallback |
| **Custom theme from Shopify's Skeleton theme** (`shopify theme init` / `Shopify/skeleton-theme`) | Minimal, modern OS 2.0 conventions. We own every line. The output is exactly the mockup. | More upfront work (cart, search, account UX built by us) | **✓ Recommended** |
| Headless (Hydrogen/Remix) | Total control, React | Higher cost and hosting. Loses the theme editor and most app blocks. Not needed for this design. | ✗ |

**Decision:** custom Online Store 2.0 theme built on Skeleton. Where Dawn already solves a hard UX problem well (predictive search, cart drawer, product media gallery, facets), port its JavaScript patterns (web components). Do not copy its markup or CSS.

## 2. Tooling

| Concern | Choice |
|---|---|
| CLI | Shopify CLI (`shopify theme dev`, `theme check`, `theme push`) |
| Source control | Git, with **Shopify GitHub integration** connected to the `main` branch → live theme. Feature branches → preview themes. |
| JS | **TypeScript** compiled by **Vite** (library mode) → `assets/*.js` (ES modules, no framework). Use small custom elements (`<cart-drawer>`, `<product-gallery>`, `<carousel-slider>`). |
| CSS | Plain modern CSS with custom properties (no Tailwind). Gives exact control and maps 1:1 to the design tokens. One `base.css` plus a per-section CSS file loaded with `{{ 'section-x.css' \| asset_url \| stylesheet_tag }}` only where needed. |
| Linting | `theme-check` (Liquid), ESLint + Prettier (TS), Stylelint (CSS) |
| Data scripts | **Python** (Admin GraphQL API): metafield/metaobject definition setup, catalog import and validator, Flow fallbacks |
| CI | GitHub Actions: theme-check, lint, TS build, Lighthouse CI against a preview theme |

### Repo layout

```
caps-and-capes-theme/
├─ src/                       # TypeScript + source CSS (built by Vite)
│  ├─ components/             # cart-drawer.ts, product-gallery.ts, carousel.ts, quantity-input.ts,
│  │                          # predictive-search.ts, mega-menu.ts, tabs.ts, facets.ts
│  ├─ lib/                    # cart-api.ts, section-rendering.ts, a11y.ts, events.ts
│  └─ entry.ts
├─ theme/                     # The Shopify theme root (pushed to Shopify)
│  ├─ assets/                 # built JS, CSS, fonts (woff2), logo.svg
│  ├─ blocks/                 # theme blocks (OS 2.0 "theme blocks") – reusable across sections
│  ├─ config/                 # settings_schema.json, settings_data.json
│  ├─ layout/                 # theme.liquid, password.liquid
│  ├─ locales/                # en.default.json (+ schema translations)
│  ├─ sections/               # one file per mockup band (see §4)
│  ├─ snippets/               # product-card, price, stars, icon-*, grade-badge, button …
│  └─ templates/              # JSON templates incl. product.graded.json, metaobject/*.json
├─ scripts/                   # Python: setup_definitions.py, import_catalog.py, validate_catalog.py
├─ .github/workflows/
└─ package.json / vite.config.ts / pyproject.toml
```

> Vite writes into `theme/assets/`. Commit the built assets, because the GitHub integration pushes the repo as-is and does not run a build. CI fails the PR if the built output is stale.

## 3. Design tokens → settings

`config/settings_schema.json` exposes the brand tokens so merchants can adjust them without code. `layout/theme.liquid` prints them as CSS variables:

```liquid
{%- # snippets/css-variables.liquid -%}
<style>
  :root {
    --color-bg: {{ settings.color_bg }};
    --color-surface: {{ settings.color_surface }};
    --color-border: {{ settings.color_border }};
    --color-text: {{ settings.color_text }};
    --color-heading: {{ settings.color_heading }};
    --color-text-muted: {{ settings.color_text_muted }};
    --color-accent: {{ settings.color_accent }};
    --color-accent-hover: {{ settings.color_accent | color_lighten: 8 }};
    --color-on-accent: {{ settings.color_on_accent }};

    --font-display: 'Outfit', system-ui, sans-serif;
    --font-condensed: 'Barlow Condensed', 'Arial Narrow', sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;

    --radius-sm: {{ settings.radius_buttons }}px;
    --radius-md: {{ settings.radius_cards }}px;
    --container: {{ settings.page_width }}px;
  }
</style>
```

Fonts are self-hosted with `@font-face` + `font-display: swap`. Preload the 2 critical files (Barlow Condensed 600, Outfit 600):

```liquid
<link rel="preload" href="{{ 'barlow-condensed-600.woff2' | asset_url }}" as="font" type="font/woff2" crossorigin>
```

Default values come from [01-brand-identity.md](01-brand-identity.md) §3.

## 4. Section & snippet inventory

### Global (section groups)

| File | Group | Mockup element |
|---|---|---|
| `sections/header.liquid` | header-group | Logo, mega nav, inline predictive search, account, cart badge |
| `sections/announcement-bar.liquid` | header-group | (optional, off) |
| `sections/footer-newsletter.liquid` | footer-group | "Stay in the loop" + logo mark |
| `sections/footer.liquid` | footer-group | Link columns, social, payments, legal |
| `sections/cart-drawer.liquid` | overlay-group | Slide-out cart |

### Homepage sections (also reusable on other pages)

| File | Mockup band |
|---|---|
| `sections/hero-split.liquid` | "Collect More. Discover Original." hero |
| `sections/category-tiles.liquid` | 5 category tiles (blocks: tile) |
| `sections/product-carousel.liquid` | "FEATURED THIS WEEK" (source: collection) |
| `sections/publisher-logos.liquid` | "SHOP BY PUBLISHER" (source: metaobjects) |
| `sections/promo-banner.liquid` | "COLLECT BEYOND THE PAGE" |
| `sections/trust-list.liquid` | Secure Shipping / Pull List Friendly / Collector Packaging |
| `sections/promo-trust-row.liquid` | Wrapper that lays out publisher + promo + trust in one row (or use a 3-col "row" section with nested theme blocks) |

### Product sections

| File | Purpose |
|---|---|
| `sections/main-product.liquid` | Breadcrumb, gallery, info column, built from **blocks**: title, meta-line, rating, price, description excerpt, spec-table, grade-badge, quantity, buy-buttons, wishlist, trust-strip |
| `sections/product-tabs.liquid` | Description / Key Details / Shipping & Returns / Grading Info |
| `sections/product-recommendations.liquid` | "YOU MAY ALSO LIKE" |
| `sections/issue-copies.liquid` | "Other copies of this issue" (raw + other grades) — not in the mockup, adds cross-sell value |

### Key snippets

`product-card.liquid` (props: `product`, `layout: 'horizontal' | 'vertical'`, `show_quick_add`), `price.liquid`, `rating-stars.liquid`, `grade-badge.liquid`, `spec-table.liquid`, `button.liquid`, `icon.liquid` (switch on name), `section-heading.liquid` (title + hairline + optional "View all" + arrows), `image.liquid` (responsive `image_url` + `srcset` + `sizes` + lazy loading), `breadcrumbs.liquid`, `quantity-input.liquid`, `trust-item.liquid`.

## 5. JavaScript components (TypeScript → custom elements)

| Element | Responsibility |
|---|---|
| `<mega-menu>` | Hover-intent + click/keyboard open, `aria-expanded`, Esc to close, focus trap in mobile drawer |
| `<predictive-search>` | Debounced (250 ms) fetch to `/search/suggest?section_id=predictive-search`, keyboard navigation, `combobox` ARIA |
| `<cart-drawer>` / `cart-api.ts` | AJAX Cart API (`/cart/add.js`, `/cart/change.js`). Uses the **Section Rendering API** to re-render drawer + header badge in one request (`sections=cart-drawer,header`). |
| `<quick-add>` | Card "ADD TO CART": posts the default variant, opens the drawer, shows a loading state on the button |
| `<carousel-slider>` | CSS scroll-snap track + prev/next buttons that disable at the ends, swipe on touch, `aria-roledescription="carousel"` |
| `<product-gallery>` | Vertical thumbnail rail with up/down arrows, main image swap, zoom (lightbox with pinch-zoom), keyboard support |
| `<quantity-input>` | − / + stepper bounded by inventory (qty 1 for slabs; hide the stepper when max = 1) |
| `<buy-now-button>` | Adds to cart and then `window.location = '/checkout'`, so we keep the mockup's custom amber styling (see doc 06) |
| `<tabs-panel>` | ARIA tabs, becomes an accordion below 768 px |
| `<wishlist-button>` | Thin adapter over the chosen wishlist app's JS API |
| `<facet-filters>` | Search & Discovery filter form → Section Rendering of the collection grid, URL sync |

No jQuery and no UI framework. Target ≤ 35 KB gzipped JS on the homepage.

## 6. Performance budget

| Metric (mobile, 4G, Lighthouse) | Target |
|---|---|
| LCP | ≤ 2.5 s (hero image preloaded with `fetchpriority="high"`) |
| CLS | ≤ 0.05 (explicit width/height on every image, font-metric overrides for fallbacks) |
| INP | ≤ 200 ms |
| Lighthouse Performance | ≥ 85 home, ≥ 90 PDP |
| Total JS (home) | ≤ 35 KB gz (excl. apps) |
| Total CSS (critical) | ≤ 25 KB gz |

Rules:
- All images go through `image_url` with `srcset`. Mark only the hero/first PDP image eager; everything else lazy.
- App embeds are audited. Each app must load async and add no more than ~30 KB.
- No layout-shifting app widgets above the fold.

## 7. Accessibility

- WCAG 2.2 AA target. Run axe in CI on the home, collection, PDP and cart drawer.
- Visible amber focus ring on every interactive element.
- The carousel works with keyboard and screen reader (prev/next buttons are real `<button>`s, and each slide is labelled "3 of 6").
- The stars have a text equivalent ("Rated 5.0 out of 5, 27 reviews").
- Respect `prefers-reduced-motion` (disable glow animation, smooth scroll and drawer slide).

## 8. Theme editor experience

- Every text, image, link and collection picker in the mockups is a setting or block. No copy is hard-coded in Liquid; use locale strings for UI labels.
- Presets for each section so merchants can add a "Category tiles" section to any page.
- Product templates use **dynamic sources** (metafields) for the spec table and grade badge, so editing is per-product data, not per-template.
