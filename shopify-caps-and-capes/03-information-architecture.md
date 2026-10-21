# 03 — Information Architecture

## 1. Primary navigation (header)

From the mockup, left → right:

| Label | Type | Target | Dropdown |
|---|---|---|---|
| NEW THIS WEEK | Link | `/collections/new-this-week` | — |
| COMICS ▾ | Mega menu | `/collections/comics` | New Releases · Back Issues · Key Issues · Graded Comics · By Publisher (logo list) · By Series A–Z · Variant Covers |
| KEY ISSUES | Link | `/collections/key-issues` | — |
| GRADED COMICS | Link | `/collections/graded-comics` | — |
| COLLECTIBLES ▾ | Mega menu | `/collections/collectibles` | Statues · Busts · Enamel Pins · Prints · Exclusives + promo tile |
| ACTION FIGURES ▾ | Mega menu | `/collections/action-figures` | By Manufacturer · By Scale · By Franchise · Accessories |
| PREORDERS | Link | `/collections/preorders` | — |
| SELL TO US | Link | `/pages/sell-to-us` | — |

- Built from the Shopify **navigation menu** `main-menu` (3 levels). The mega-menu promo tiles and publisher logos come from **section blocks** in the header group, so merchants can edit them.
- Right side of the header: **inline search field** ("Search for comics, products, and more…") with predictive search, then **Account** (icon + label), then **Cart** (icon + label + count bubble).
- Header behaviour: sticky. It shrinks from about 76 px to 60 px after scrolling 80 px. Background is `--color-bg` with a bottom hairline that only appears when stuck.
- Mobile (< 1024 px): hamburger left, logo centre, search + cart icons right. The menu opens as a full-height drawer with accordion levels, and search expands below the header.

## 2. Footer

| Column | Content |
|---|---|
| Brand block | Logo mark · "STAY IN THE LOOP" · "New releases, exclusive drops, and collector deals." · email input + SIGN UP (Shopify customer newsletter form) |
| SHOP | New This Week, Comics, Key Issues, Graded Comics, Collectibles, Action Figures, Preorders (menu `footer-shop`) |
| CUSTOMER CARE | Contact Us, Shipping & Returns, FAQ, Pull List, Sell To Us (menu `footer-care`) |
| ABOUT | About Caps & Capes, Why Shop With Us, Collector Packaging, Store Credit (menu `footer-about`) |
| FOLLOW US | Social icons from theme settings (Facebook, Instagram, X, YouTube, TikTok) · "We accept" + payment icons |
| Bottom bar | `© {{ 'now' \| date: '%Y' }} Caps & Capes. All rights reserved.` · Privacy Policy · Terms of Service (`shop.privacy_policy`, `shop.terms_of_service`) |

## 3. URL map & templates

| URL | Template | Notes |
|---|---|---|
| `/` | `index.json` | Doc 05 |
| `/collections/{handle}` | `collection.json` | Standard listing: banner, filters (Search & Discovery), sort, grid of vertical product cards |
| `/collections/graded-comics` | `collection.graded.json` | Adds grade/company/page-quality filters as chips and a "How grading works" band |
| `/collections/preorders` | `collection.preorders.json` | Groups by release month, shows the release date on cards |
| `/collections/all` | `collection.json` | — |
| `/products/{handle}` | `product.graded.json` / `product.comic.json` / `product.collectible.json` | Doc 06 |
| `/pages/publishers` | `page.publishers.json` | Grid of all Publisher metaobjects |
| `/pages/publishers/{handle}` | `metaobject/publisher.json` | Publisher logo, about text, series list, products |
| `/pages/series/{handle}` | `metaobject/series.json` | Series hero, issue list, "Add to Pull List" CTA |
| `/pages/sell-to-us` | `page.sell-to-us.json` | Buylist explainer + form |
| `/pages/pull-list` | `page.pull-list.json` | Explainer (v1), management UI (Phase 2) |
| `/pages/about`, `/pages/why-shop-with-us`, `/pages/collector-packaging`, `/pages/store-credit`, `/pages/faq`, `/pages/contact` | `page.json` / `page.faq.json` / `page.contact.json` | Content pages built from reusable sections |
| `/policies/shipping-policy`, `/policies/refund-policy` | Shopify policies | Linked from the PDP Shipping & Returns tab |
| `/search` | `search.json` | Tabs for products / pages / articles, same filters as collections |
| `/cart` | `cart.json` | The cart drawer is the main cart UI, and the page is a fallback |
| `/account/*` | New Customer Accounts (Shopify-hosted, brand-styled) | Configure the brand colors and logo in Checkout & Accounts editor |
| `/blogs/news` | `blog.json` / `article.json` | Optional "Collector's Corner" content for SEO |

## 4. Collection page (not mocked — derived from the system)

- **Header band:** collection title (H1 condensed UPPER), description, optional hero image with the glow treatment.
- **Toolbar:** product count · sort (Featured, Newest release, Price ↑↓, Grade ↓ for graded) · grid/list toggle.
- **Filters (left sidebar desktop, drawer on mobile)**, from Search & Discovery:
  - All: Availability, Price, Product type, Publisher (`custom.publisher`), Preorder.
  - Comics: Series, Key issue, Release date (year), Cover artist.
  - Graded: Grading company, Grade (range), Page quality, Label type.
  - Collectibles: Manufacturer, Franchise, Scale, Material.
- **Grid:** 4 columns at xl, 3 at lg, 2 at md and below. Vertical product cards. Paginate with "Load more" (progressive enhancement over `paginate`).

## 5. Search

- Header input uses the **Predictive Search API** (`/search/suggest`). The dropdown shows up to 4 products with thumbnail, title and price, plus collection, page and query suggestions.
- Synonyms (Search & Discovery): "cgc" ↔ "graded", "slab" ↔ "graded", "fig" ↔ "figure", "tpb" ↔ "trade paperback", "#1" ↔ "first issue".

## 6. Content model for editable marketing

| Need | Mechanism |
|---|---|
| Hero, category tiles, promo banners | Section settings + blocks on `index.json` |
| Publisher strip | Metaobject list (`publisher` where `featured = true`, sorted by `sort_order`) |
| Trust points | Metaobject list `trust_point`, shared by the homepage and PDP |
| Announcement bar (optional, not in mockup) | Header group section, off by default |
