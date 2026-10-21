# Caps & Capes — Custom Shopify Storefront Plan

Planning space for building **capsandcapes.com**, a dark, premium comic book & collectibles store on Shopify.
The storefront must look exactly like the two approved mockups and carry their brand identity.

| Mockup | File |
|---|---|
| Homepage | [`mockups/01-homepage.png`](mockups/01-homepage.png) |
| Product page (graded comic) | [`mockups/02-product-graded-comic.png`](mockups/02-product-graded-comic.png) |

## How to read these docs

The docs follow a **domain-first** order: first what the brand and the business objects *are*, then how Shopify represents them, then how the theme renders them, and last how we deliver it.

| # | Doc | What it answers |
|---|---|---|
| 01 | [Brand identity & design system](01-brand-identity.md) | Colors, type, logo, icons, components, and the design tokens taken from the mockups |
| 02 | [Domain model](02-domain-model.md) | Comics, slabs, collectibles, publishers, series, pull lists, and how each maps to Shopify products, metafields and metaobjects |
| 03 | [Information architecture](03-information-architecture.md) | Navigation, collections, URLs, templates and content pages |
| 04 | [Theme architecture](04-theme-architecture.md) | Starting theme, file layout, build tooling, CSS/JS conventions, editor settings |
| 05 | [Homepage spec](05-homepage-spec.md) | Each homepage section: layout, data source, settings and behaviour |
| 06 | [Product page spec](06-product-page-spec.md) | PDP for graded comics, raw comics and collectibles |
| 07 | [Apps & integrations](07-apps-and-integrations.md) | Reviews, wishlist, preorders, pull list, search, newsletter, sell-to-us, and the build-or-buy call for each |
| 08 | [Delivery roadmap](08-roadmap.md) | Phases, tasks, acceptance criteria, QA, launch checklist |
| 09 | [Open questions & risks](09-open-questions.md) | Decisions the business needs to make, and gaps in the mockups |

## Approach in one paragraph

Build a **custom Online Store 2.0 theme** from Shopify's minimal starter (Skeleton theme), not a re-skin of a heavy theme. All colors, fonts and spacing live in one design-token layer (`tokens.css`, driven by `settings_schema.json`). Each mockup block is a **section** that merchants can reorder and edit in the theme editor. Comic-specific data (grade, publisher, series, key issue notes, cover artist) lives in **metafields and metaobjects**, so templates render it with no hard-coded content. Native Shopify features (Search & Discovery, Flow, Forms, store credit, Customer Accounts) cover most needs. Apps fill the gaps (reviews, wishlist, preorders). The pull list is the one custom build we may want.

## Scope summary

- **In scope (v1):** header + mega menu, homepage, collection/listing pages, PDP (3 variants), cart drawer + cart page, search, account pages (via theme/Customer Accounts), content pages (About, FAQ, Shipping, Sell To Us), newsletter, reviews, wishlist, preorders, mobile responsive design.
- **Phase 2:** pull list, CGC census lookups, buylist intake workflow, loyalty/store credit UX.
- **Out of scope:** headless/Hydrogen rebuild (not needed for this design), POS, marketplace sync (eBay etc.).
