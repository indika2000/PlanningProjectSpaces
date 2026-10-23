# 11 — Shopify Setup, Inventory & Content Operations

How to set up the Shopify store, run inventory day to day, and manage every editable part of the site (the "CMS").

**Short answer to "do I need an app to manage sections like Featured?"** No, not a separate one. Shopify's admin *is* the content system for this design:

| What you edit | Where in Shopify | Example |
|---|---|---|
| Which sections appear on a page, their order, copy and which collection they show | **Online Store → Themes → Customize** (theme editor) | Swap the homepage "Featured this week" carousel to a different collection, or reorder sections |
| Which products are in a curated list, and their order | **Products → Collections** (manual collection, drag to sort) | Add this week's picks to `featured-this-week` |
| Structured content: banners, topics, sets, publishers, grading companies, trust points | **Content → Metaobjects** | Create a new showcase banner with dates; upload a Pokémon logo |
| Menus | **Online Store → Navigation** | Add a new topic to the Trading Cards menu |
| Pages, guides, policies | **Online Store → Pages / Blog posts**, **Settings → Policies** | Edit the card condition guide |
| Images & files | **Content → Files** | Upload banner art |
| Automation (tags, counts, expiry) | **Shopify Flow** (free Shopify app) | Weekly "New arrivals" rotation |
| Bulk data in and out | **Matrixify** (paid app) or CSV import, plus our Python scripts | Import 500 raw singles from a spreadsheet |

The theme is built so each of these maps directly onto a part of the design (§7). A custom admin app is only worth considering later, for faster intake of graded cards (§5.6).

Related docs: [02 domain model](02-domain-model.md), [07 apps](07-apps-and-integrations.md), [10 cards, topics & showcases](10-cards-topics-and-showcases.md).

---

## 1. Roles

| Role | Typical person | Does | Needs access to |
|---|---|---|---|
| **Owner** | You | Plan, payments, payouts, pricing policy, approving logos and big homepage changes | Everything |
| **Catalog / intake** | Shop staff | Lists new stock, sets grades and conditions, takes photos, adjusts inventory, processes buy-ins | Products, Inventory, Files, Metaobjects (entries only), Orders (fulfil) |
| **Merchandiser / content** | Owner or marketing help | Banners, featured collections, menus, guides, newsletters | Theme editor (customize, not code), Collections, Metaobjects, Pages, Blog, Navigation, Files, Marketing |
| **Fulfilment** | Shop staff | Picks, packs, ships, handles returns | Orders, Fulfilment, Customers (view) |
| **Developer** | Agency / freelancer | Theme code, metafield & metaobject definitions, Flow workflows, scripts | Collaborator account (doesn't use a staff seat), Themes (edit code), Apps, Settings as needed |

## 2. Store setup checklist

Do these in order. ☐ = one-time task.

### 2.1 Account & plan
- ☐ Create the store on a plan that covers **staff accounts for every person in §1**, **Shopify Flow**, and the reports you want. Plan limits and pricing change, so check the current plan comparison page before choosing. Upgrade later if staff count grows; the theme and data don't change.
- ☐ Turn on two-step authentication for every staff account.
- ☐ Add staff with the permissions in §1. Give the developer a **collaborator** request instead of a staff seat.
- ☐ **Settings → Store details**: legal name, address, contact email, currency, unit system, order ID format (e.g. `CC-1001`).

### 2.2 Domain & brand
- ☐ **Settings → Domains**: connect `capsandcapes.com`, set it as primary, redirect `www`.
- ☐ **Settings → Brand**: logo, square logo, colours (`#050607`, `#F7A21B`), cover image, short description, social links. Checkout, customer accounts, Shop and emails pull from here.
- ☐ **Settings → Checkout → Customize**: logo, colours, Inter/Barlow-style fonts (from Shopify's font list), button radius 2 px. Matching the dark theme exactly may be limited by checkout branding options; aim for "clearly the same brand".
- ☐ **Settings → Notifications**: logo + accent colour on order emails; edit the order-confirmation text for preorders ("ships on release").

### 2.3 Payments & checkout
- ☐ **Settings → Payments**: Shopify Payments (cards, Shop Pay, Apple Pay, Google Pay), PayPal if wanted.
- ☐ Set **fraud review** rules: hold orders above a value (e.g. $500) or with a billing/shipping mismatch for manual review. Graded cards are a common fraud target.
- ☐ **Settings → Checkout**: require customer accounts *optional*, collect phone (needed for signature delivery), enable address autocomplete, tipping off.
- ☐ **Store credit**: confirm store credit is available on your plan/region (used for Sell To Us payouts).

### 2.4 Locations & inventory settings
- ☐ **Settings → Locations**: one location per physical stock place (e.g. `Back room`, `Shop floor`, `Vault safe`). If there's only one building, start with one location. You can split later.
- ☐ Default: **track quantity on**, **continue selling when out of stock off** for every product. Exceptions are made per product (preorders handled by the preorder app).

### 2.5 Shipping
- ☐ **Settings → Shipping and delivery**: create shipping **profiles**:
  - `Standard`: raw comics, raw cards, supplies (letter/flat rates or calculated).
  - `Graded & high-value`: all slabs and sealed boxes. Calculated rates with **signature required** and insurance above a value threshold.
  - `Statues & oversized`: weight/dimension based.
- ☐ Package presets: comic mailer, toploader envelope, slab box, statue box (weights and sizes, so labels price correctly).
- ☐ Free-shipping threshold (the cart drawer progress bar reads this): decide the amount (open question in doc 09).
- ☐ Local pickup at the shop if you have one.

### 2.6 Taxes, markets, policies
- ☐ **Settings → Taxes and duties**: register where you collect. Check whether collectibles have special rules in your region.
- ☐ **Settings → Markets**: domestic at launch. If international, consider excluding slabs over a value from export markets.
- ☐ **Settings → Policies**: refund (30 days, eligible items; graded/sealed condition rules), shipping, privacy, terms, contact. The product page "Shipping & returns" tab links here.

### 2.7 Apps to install
| App | Required? | For |
|---|---|---|
| Shopify Flow | Yes | Automation (§6) |
| Shopify Search & Discovery | Yes | Filters, synonyms, recommendations, boosts |
| Shopify Forms | Yes | Sell To Us, pull list sign-up, newsletter interests |
| Shopify Email (or Klaviyo) | Yes | Newsletters, drop announcements |
| Reviews app | Yes | Stars, `reviews.rating` metafields (doc 07) |
| Wishlist app | Yes | Save to wishlist |
| Preorder app (selling plans) | Yes | Preorders & deposits |
| Back-in-stock app | Recommended | "Notify me" |
| **Matrixify** | Recommended | Bulk import/export of products, metafields and metaobjects |
| Retail Barcode Labels (Shopify) | Recommended | Shelf/slab labels with SKU barcode |
| Shopify POS | If you have a physical shop | One inventory for online + counter |
| Marketplace/eBay sync app | Only if selling elsewhere | Prevents double-selling unique slabs |

### 2.8 Content model (developer, one-time)
- ☐ Run `scripts/setup_definitions.py` (doc 07 §4). It creates every **metafield definition** (product, variant, collection, customer) and **metaobject definition** from docs 02 and 10, with:
  - **Storefront access: read** (so the theme can show them),
  - **Validations** (grade 0.5–10, choice lists for format/condition/company),
  - **Filtering enabled** on the facet fields (Search & Discovery),
  - Metaobject capabilities: **Publishable** (draft/active status) on `showcase`, `topic` and `card_set`; **Renderable / web pages** on `publisher`, `series`, `card_set` (optional); **Translatable** if you'll localise.
- ☐ **Pin** the product metafields staff need on the product form (Settings → Custom data → Products → pin). Pinned fields show on **every** product, so the script orders them by namespace (`catalog` → `grading` → `card` → `comic` → `collectible`) and names them clearly ("Grading · Grade"). Staff leave irrelevant groups blank. If that gets noisy, the Phase 2 intake app (§5.6) shows only the fields for the chosen product type.
- ☐ Check whether Shopify's **standard product category** for comics/trading cards offers attributes (category metafields) that overlap ours. Use them where they fit; they also feed Google/Shop listings.
- ☐ Create the seed entries: departments, the six topics, grading companies (CGC, CBCS, PSA, BGS, SGC, CGC Cards, TAG), manufacturers, publishers, trust points.
- ☐ Create collections (scripted): per-topic, per-topic-per-format (with **inventory stock > 0** rule), `graded`, `new-arrivals`, `featured-this-week`, `{topic}-grails`, `vault-highlights` (doc 10 §3.5).
- ☐ Navigation menus: `main-menu`, `footer-shop`, `footer-topics`, `footer-care`, `footer-about`.
- ☐ Install Flow workflows (§6) and turn them on.

### 2.9 Theme
- ☐ Connect the GitHub repo (Online Store → Themes → Add theme → Connect from GitHub). `main` = live theme branch.
- ☐ Keep a duplicate **"Staging"** theme for previewing big content changes (§7.4).
- ☐ Set theme settings: colours, fonts, social links, free-shipping threshold display, default product card style.

## 3. Product & inventory model in the admin (quick reference)

| Selling | Product type | One product = | Variants | Qty | Key fields to fill |
|---|---|---|---|---|---|
| Graded comic | `Graded Comic` | one slab | none | 1 | catalog.*, comic.issue, grading.company / grade / cert / page quality, front + back photos |
| Raw comic | `Comic` | one issue + cover | condition (optional) | N | catalog.*, comic.issue, cover label |
| Graded card | `Graded Card` | one slab | none | 1 | catalog.*, card.ref (or set/subject/number fields), grading.* incl. subgrades/auto grade, front + back + label photos |
| Raw card | `Raw Card` | one card | Condition (NM/LP/MP/HP/DMG) × Language | N per variant | catalog.*, card.ref, variant prices |
| Sealed | `Sealed` | one SKU | box / case (optional) | N | catalog.*, card_set, barcode (UPC) |
| Collectible | `Collectible` / `Action Figure` | one SKU | edition | N | catalog.*, collectible.* |

**Product status:** `Draft` while listing, `Active` when ready (and published to Online Store / POS), `Archived` when a unique item has sold (Flow does this).

**SKU & barcode:** follow doc 10 §3.4. For slabs, put the cert number in **Barcode** too, so scanning the slab label finds the product.

## 4. Inventory operations

### 4.1 Daily
1. **Fulfil orders** (Orders → Unfulfilled). Pull slabs from the vault by SKU/cert; scan to confirm.
2. **Check Flow alerts** (email/Slack): negative inventory, duplicate cert, high-value orders on hold.
3. **List new stock** from the intake tray (§5).

### 4.2 Weekly
| Day | Task |
|---|---|
| Mon–Tue | Receive the comics distributor shipment for the week. Check it against the order, create or restock products, and set `catalog.release_date` = Wednesday. |
| Wed (new comic day) | Flow rotates `new-arrival` tags overnight. Check the homepage "New arrivals" and the Comics topic hero. Fulfil pull lists. |
| Thu | Card set release days vary, so check the set release calendar (topic guides) for upcoming sealed drops and preorder shipments. |
| Fri | Update `featured-this-week` (§7.2). Review sold-out raw singles for reorders/buys. |

### 4.3 Monthly / quarterly
- **Cycle count** one location or category per week, so everything is counted each quarter. Use Inventory → filter by location/type → adjust with the reason "Cycle count".
- **Full vault audit** quarterly: every active graded product must be physically present (scan barcode = cert).
- **Pricing review** for graded and sealed (market prices move). Use the bulk editor (Products → select → Bulk edit → Price) or a Matrixify export → edit → import.
- **Dead-stock review**: raw singles with no sales in 6 months → bundle into lots or discount.
- **Reports**: Analytics → Reports → inventory (sell-through, days of inventory, ABC analysis), sales by product type/topic.

### 4.4 Receiving stock from suppliers
- If your admin has **Inventory → Purchase orders / Transfers**, use them for distributor orders, so incoming quantities show before arrival. Otherwise keep the distributor invoice and adjust on receipt with the reason "Received".
- Preorders: the preorder app tracks sold quantity against expected stock. On release day, receive stock and let the app release orders for fulfilment.

### 4.5 Buy-ins (Sell To Us)
1. A form submission arrives (Shopify Forms → email + customer tagged `seller`).
2. Make an offer by email. On acceptance, receive the items and inspect them.
3. Pay out: **store credit** (Customers → customer → Store credit → Issue) or cash outside Shopify.
4. List the items via intake (§5) and put the seller's customer ID in an internal note/metafield (`custom.acquired_from`) for provenance.

### 4.6 Multichannel (if you also sell on eBay etc.)
Pick one system of record (Shopify). Use a sync app that removes the listing everywhere when a unique slab sells on any channel. Test it with a slab before launch. If no sync is in place, **don't list unique slabs on two channels**.

## 5. Intake playbooks (step by step)

### 5.1 Graded card or comic (one slab)
1. Products → **Add product** (or duplicate a similar slab and edit it, which is faster).
2. Title using the convention (doc 10 §3.4). Product type `Graded Card` / `Graded Comic`. Template: `graded-card` / `graded`.
3. Photos: front, back, label close-up, plus an edge shot for high value. Shoot on black (doc 01 §8). Alt text = title + "front/back".
4. Price, cost (for margin reports), SKU = `{DEPT}-{TOPIC}-GR-{cert}`, Barcode = cert, Quantity 1, location = Vault.
5. Pinned fields: **catalog** department / topic / format = Graded; **grading** company, grade, cert, label, subgrades (if BGS etc.), auto grade, pop (optional); **card** ref or set/subject/number/variant/attributes (cards) or **comic** issue (comics).
6. Shipping profile: `Graded & high-value`.
7. Save as **Draft**, preview, then set **Active**. Flow adds tags, counts update and the slab appears on its topic page.

### 5.2 Raw singles (batch)
1. Sort cards by set, then card number, then condition.
2. In a spreadsheet: one row per card × condition × language with quantity and price (template in `scripts/templates/raw_singles.csv`).
3. Import with Matrixify (or `import_catalog.py`). New cards create products with Condition/Language variants; existing ones get stock added.
4. Spot-check 5 products on the storefront.

### 5.3 Sealed
Scan the UPC in Products search. If found → adjust quantity. If not → add the product (type `Sealed`, card_set, photos), barcode = UPC.

### 5.4 New comics week
Import the distributor's weekly list (CSV) → `import_catalog.py` maps it to issue metaobjects + products, release date and covers. Review covers and prices, then set Active on Wednesday (or schedule with Flow).

### 5.5 Reference data (once per set/series)
Before listing a new card set or comic series, create its **card_set** / **series** metaobject entry (logo per doc 10 §3.8, year, code, era). Bulk-load card lists for big TCG sets from the chosen catalog data source (doc 09 Q12).

### 5.6 Phase 2: intake app (optional)
A small embedded admin app (or admin UI extension on the product page) that:
- asks for **product type first**, then shows only the relevant fields;
- looks up cert numbers where the grader offers lookup/API data and pre-fills grade, card, year;
- builds the title and SKU automatically and checks for duplicate certs before saving.

This saves time once volumes reach dozens of slabs a week. It isn't needed to launch.

## 6. Automation (Shopify Flow) catalogue

| Workflow | Trigger | What it does | Owner |
|---|---|---|---|
| Mirror tags | Product created / updated | Writes `dept:`, `topic:`, `format:`, `card:`, `issue:` tags from metafields (powers collections and counts) | Dev sets up |
| New arrivals rotation | Scheduled weekly (Wed 00:05) | Removes old `new-arrival` tags; tags products activated in the last 7 days | Auto |
| Slab sold | Order fulfilled with a graded item | Archives the product after fulfilment (stays reachable by URL for SEO) | Auto |
| Duplicate cert | Product created | Alerts if another product has the same cert number | Catalog |
| Negative inventory | Inventory quantity changed | Alert + tag for review | Catalog |
| High-value order | Order created over threshold | Tag `high-value`, hold for review, email owner | Owner |
| Showcase expiry | Scheduled nightly | Turns off expired showcases; emails marketing 3 days before a hero expires | Merchandiser |
| Logo licence expiry | Scheduled nightly | Turns off `mark_approved` after `mark_expires`; alerts 30 days before | Owner |
| Buy-in received | Form submitted | Tags customer `seller`, notifies buyer staff | Owner |
| Preorder release | Scheduled daily | On release date: remove `preorder` tag, notify staff to receive stock | Catalog |

If Flow can't do a step (e.g. complex metaobject queries), the equivalent runs as a scheduled Python script via GitHub Actions using the Admin API (doc 07 §2).

## 7. CMS components: what you can edit and how

### 7.1 Component catalogue

Every block in the designs, where its content comes from, and how to change it.

| Component (canvas board) | Content source | How to change it | Who / how often |
|---|---|---|---|
| **Announcement bar** (optional) | Theme editor → Header group | Toggle on, edit text/link | Merch · as needed |
| **Header & mega menus** (Desktop mega menus, Mobile menu) | Navigation `main-menu` + `department`/`topic` metaobjects (topic lists, counts) + `mega_menu_tile` showcase | Edit menu links in Online Store → Navigation; change promo tile by editing the department's showcase | Merch · monthly |
| **Home hero carousel** (Desktop/Mobile home) | Section setting: list of `showcase` entries (placement `home_hero`) | Theme editor → Home → Hero → pick/reorder showcases. Create new ones in Content → Metaobjects → Showcase | Merch · weekly–monthly |
| **Shop by topic tiles** | `topic` metaobjects (name, accent, logo, image) + **automatic counts** | Edit a topic entry; reorder via the section's topic list | Merch · rarely |
| **Featured this week** carousel + department tabs | Section setting → collection (default `featured-this-week`); tabs filter by `catalog.department` automatically | Products → Collections → *Featured this week* → add/remove products, drag to sort. Or point the section at another collection | Merch · weekly (Fri) |
| **Showcase split banners** | Section setting: 2 showcase entries (placement `home_split`) | Theme editor → pick showcases; dates control visibility | Merch · per campaign |
| **Shop the inventory** matrix | Automatic: topic × format collections' in-stock counts | Nothing to edit day to day. To add a topic/format, add it to the topic's `formats_enabled` and create its collection | Dev/Merch · rarely |
| **The Vault** | Section setting → collection (default `vault-highlights`, manual) + grader chips from `grading_company` entries | Edit the collection | Merch · weekly |
| **Publisher & maker strip** | `publisher` + `manufacturer` entries with `featured = true`, `sort_order` | Tick featured / set order in Metaobjects | Merch · rarely |
| **Trust list / strips** | `trust_point` entries, referenced by home section and per topic | Edit text/icon in Metaobjects | Owner · rarely |
| **Footer** (newsletter, link columns, social, payments) | Theme editor footer group + footer menus + Settings → Brand (social) + payment methods (automatic) | Edit menus / theme editor | Merch · rarely |
| **Topic page hero** (Pokémon, Baseball) | Topic's `hero_showcases` (placement `topic_hero`) | Edit the topic entry → reorder its showcases | Merch · per campaign |
| **Format tabs with counts** | Automatic | — | — |
| **Shop by set / Rookies to watch** | Topic's `featured_sets` (card_set entries) or `featured_subjects` | Edit topic entry | Merch · per set release |
| **Topic grid & filters** | Products + Search & Discovery filter config | Filters: Search & Discovery app → Filters; product data via intake | Dev once, Catalog daily |
| **Topic inline banner** | Topic's `inline_showcase` | Edit topic entry | Merch · per campaign |
| **Collector guides** | Blog `guides` articles referenced by topic | Write in Online Store → Blog posts; attach to topic | Merch · monthly |
| **Product page: specs, grade panel, subgrades, "other copies"** | Product metafields + grading company entry + Flow tags | Filled at intake | Catalog · per product |
| **Product page tabs: Shipping & Returns, Grading info** | Shared page + `grading_company.about` | Edit once in Pages / Metaobjects | Owner · rarely |
| **Recommendations** | Shopify recommendations + Search & Discovery "related/complementary" | Search & Discovery → Product recommendations | Merch · optional |
| **Brand marks / logos** | Brand-mark fields on topic/set/publisher/maker/grader (doc 10 §3.8) | Upload file + tick `mark_approved` | Owner · when rights confirmed |
| **Sell To Us, Pull List, About, FAQ pages** | Pages built from theme sections (text, FAQ accordion, form) | Theme editor on the page template + Pages | Owner · rarely |
| **Search synonyms & boosts** | Search & Discovery | Add synonyms ("slab" ↔ "graded"), boost products | Merch · monthly |

### 7.2 How-to: change "Featured this week"
1. Products → Collections → **Featured this week** (manual collection).
2. Remove last week's products; **Add products** → search → add 6–12.
3. Sort: **Manually** → drag so the first 6 mix departments (at least one comic and one card; the section warns otherwise).
4. Save. The homepage updates immediately; the department tabs work automatically.
*Alternative:* for a themed week, create a new manual collection (e.g. `pokemon-week`) and point the section at it in the theme editor (Home → Featured → Collection).

### 7.3 How-to: launch a banner (showcase)
1. Upload art to Content → Files (desktop + mobile sizes from doc 10 §5.2).
2. Content → Metaobjects → **Showcase** → Add entry: placement, topic, eyebrow, headline, CTA, images, start/end dates, status **Active**.
3. Attach it: homepage → theme editor → Hero (or Split) → add showcase; topic → edit topic entry → `hero_showcases`.
4. Preview (theme editor preview, or the Staging theme for a dated future banner).
5. It goes live at the start date and disappears after the end date, with no further action.

### 7.4 How-to: add a logo you now have rights to
1. Content → Metaobjects → open the topic (or set / publisher / maker / grader).
2. Upload `mark_mono` (single-colour SVG), optionally `mark_full` and `mark_icon`.
3. Fill `mark_min_height`, `mark_background` and `mark_expires` from the licence terms; note the licence in `mark_usage_note`.
4. Tick **`mark_approved`** and save. The logo replaces the text fallback in every slot listed in doc 10 §3.8.
5. Untick to remove it everywhere instantly.

### 7.5 How-to: add a new topic (e.g. Lorcana or Hockey)
1. Content → Metaobjects → **Topic** → add: name, department, accent colour, filter profile (`tcg` or `sports`), formats enabled.
2. Run `scripts/create_topic.py lorcana` (creates the hub + per-format collections with the in-stock rule).
3. Add the topic to the department's `topics` list and to the menu.
4. Add showcases, featured sets and guides when ready. Counts appear automatically once products are tagged with the topic.

### 7.6 Publishing safely
- Small edits (text, collection products, a banner): edit live in the theme editor. They're low-risk and changes are versioned.
- Big homepage changes: duplicate the live theme → edit the copy → share the preview link → publish when approved. Note: theme JSON edits made by staff in the live theme editor must be pulled back into Git by the developer (the GitHub integration syncs editor changes as commits). Agree who owns `templates/*.json` to avoid overwrites.
- Never edit theme **code** in the admin; that's the developer's Git workflow.

## 8. Launch-readiness checklist (operations)

- [ ] Staff accounts created with §1 permissions; 2FA on.
- [ ] Shipping profiles tested with a real slab, a raw card and a statue (label prices correct, signature on graded).
- [ ] 10 graded, 30 raw singles, 5 sealed, 10 comics, 3 collectibles listed through the intake playbooks (proves the playbooks work).
- [ ] Every Flow workflow tested once (create a test product, test order, an expired showcase).
- [ ] Counts on the homepage matrix match a manual count for one topic.
- [ ] One banner scheduled for the future and confirmed it appears on its start date.
- [ ] Logo fallback checked with no marks uploaded, then with one approved mark.
- [ ] Vault audit done: physical slabs = active graded products.
- [ ] Refund/return process rehearsed, including store credit.
