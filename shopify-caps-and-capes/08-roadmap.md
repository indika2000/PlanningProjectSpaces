# 08 — Delivery Roadmap

Estimates are for **1 Shopify theme developer + part-time designer/content + store owner**. Adjust to your team size.

## Phase 0 — Foundations (week 1)

| # | Task | Output / done when |
|---|---|---|
| 0.1 | Get source design files (Figma) + vector logo + font confirmation | Assets in repo `design/`. Tokens confirmed against doc 01. |
| 0.2 | Design the missing screens: **mobile** home + PDP, collection page, cart drawer, mega menu, search dropdown, account, Sell To Us | Approved low-fi → hi-fi, built from the same component inventory |
| 0.3 | Shopify store set up: plan, domain, Markets, taxes, payments, shipping profiles (incl. graded/insured), policies | Store can take a test order |
| 0.4 | Repo + tooling: Skeleton theme init, Vite/TS, linting, GitHub integration, CI (theme-check, lint, build check) | `shopify theme dev` runs. A PR opens a preview theme. |
| 0.5 | Run `setup_definitions.py`: metafields + metaobjects from doc 02 | Definitions visible in admin, pinned per product type |

## Phase 1 — Design system in code (week 2)

| # | Task | Done when |
|---|---|---|
| 1.1 | `settings_schema.json` tokens, `css-variables.liquid`, `base.css` (reset, type scale, utilities, container) | Token page renders all colors/type correctly |
| 1.2 | Fonts self-hosted + preloaded | No FOIT. CLS from fonts < 0.01. |
| 1.3 | Snippets: button (4 variants), icon set, price, rating-stars, section-heading, image, quantity-input, trust-item, grade-badge, breadcrumbs | A hidden `page.styleguide.json` template shows every component in every state |
| 1.4 | Product card (horizontal + vertical) with quick add | Visual match to both mockups |

## Phase 2 — Global chrome (week 3)

| # | Task | Done when |
|---|---|---|
| 2.1 | Header: logo, mega menu (desktop) + drawer (mobile), sticky shrink | Keyboard + screen-reader tested |
| 2.2 | Predictive search | Results < 300 ms after debounce. Arrow-key navigation works. |
| 2.3 | Cart drawer + cart page (AJAX + Section Rendering API) | Add/update/remove without reload. Badge syncs. |
| 2.4 | Footer + newsletter | Signup creates a subscribed customer |

## Phase 3 — Homepage (week 4)

Sections from doc 05: hero-split, category-tiles, product-carousel, publisher-logos, promo-banner, trust-list, the 3-column row, and presets.
**Done when:** the homepage acceptance criteria in doc 05 pass, including the screenshot diff against `mockups/01-homepage.png`.

## Phase 4 — Product pages (weeks 5–6)

| # | Task |
|---|---|
| 4.1 | `main-product` with all blocks (doc 06 §2) |
| 4.2 | Gallery + lightbox zoom |
| 4.3 | Buy-now flow (Option A) |
| 4.4 | Product tabs + accordion on mobile |
| 4.5 | Recommendations + issue-copies sections |
| 4.6 | 3 templates (graded / comic / collectible) + JSON-LD |
| 4.7 | Reviews app + wishlist app installed and themed |

**Done when:** the PDP acceptance criteria in doc 06 pass for one product of each type.

## Phase 5 — Listing, search & content (week 7)

- Collection template(s) with Search & Discovery filters, sort and load-more.
- Search results page.
- Metaobject web templates: publisher, series. Publishers index page.
- Content pages: About, Why Shop With Us, Collector Packaging, Store Credit, FAQ (accordion), Contact, Shipping & Returns, Sell To Us (form), Pull List (explainer + form).
- 404 page and password page in brand style.

## Phase 6 — Catalog, automation & apps (week 8, overlaps)

- Import the real catalog via `import_catalog.py` → `validate_catalog.py` clean.
- Product photography to the doc 01 §8 guidelines.
- Flow workflows from doc 07 §2.
- Preorder app + back-in-stock app configured.
- New Customer Accounts branding. Checkout branding (logo, colors, fonts) in the Checkout editor.

## Phase 7 — QA & launch (week 9)

### QA matrix

| Area | Checks |
|---|---|
| Visual | Playwright screenshot diffs at 375 / 768 / 1024 / 1440 vs. approved designs |
| Browsers | Chrome, Safari (macOS + iOS), Firefox, Edge, Samsung Internet |
| Functional | Add to cart (raw qty N, slab qty 1), buy now, preorder checkout, sold out, discount codes, store credit at checkout, newsletter, forms, wishlist, reviews |
| A11y | axe CI clean. Manual keyboard + VoiceOver pass on home/PDP/cart. |
| Perf | Lighthouse CI budgets from doc 04 §6 |
| SEO | Redirects from any old site, sitemap, robots, JSON-LD, meta titles, OG images |
| Content | Every link in the nav/footer resolves. No lorem ipsum. Policies published. |

### Launch checklist

- [ ] Domain connected, SSL active, `www` → apex redirect decided
- [ ] Payments live (incl. Shop Pay, Apple/Google Pay); test order refunded
- [ ] Shipping rates & insured graded profile verified
- [ ] Taxes / Markets configured
- [ ] Analytics pixels firing (Customer Events)
- [ ] Theme published from `main`. Previous theme kept as rollback.
- [ ] Monitoring: Shopify status + uptime ping + weekly Lighthouse run

## Phase 8 — Post-launch (Phase 2 features)

1. Pull list custom app (doc 07 §3), after validating demand with the form.
2. Buylist portal with photo upload + offer workflow → store credit.
3. Collector tiers / loyalty on store credit.
4. "New This Week" automated email (Klaviyo/Shopify Email).
5. A/B test: custom Buy-it-now vs. native accelerated checkout on the PDP.

## Cards & topics addendum

The comics + cards scope ([doc 10](10-cards-topics-and-showcases.md)) adds about **1.5–2 weeks**: the topic template, showcases and availability counts (≈1 week, Phases 3/5), and the card product pages and raw/graded intake (≈0.5–1 week, Phases 4/6). Revised estimate: **≈11 weeks to launch**.

## Timeline summary

```
Wk  1  2  3  4  5  6  7  8  9
P0  ██
P1     ██
P2        ██
P3           ██
P4              █████
P5                    ██
P6                    █████
P7                          ██ → launch
```

≈ **9 weeks to launch** for one developer. The mobile/missing-screen design work (0.2) is the main schedule risk.
