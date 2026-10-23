# 07 — Apps, Integrations & Automation

Principle: **native Shopify first, then a small set of well-supported apps, then custom code only where the comic domain demands it.** Every app must support theme app extensions / app blocks (no script-injection into theme files) and must be styleable to our tokens.

## 1. Build-or-buy matrix

| Capability (from mockups) | Approach | Notes |
|---|---|---|
| Product search + filters | **Native: Shopify Search & Discovery** | Filters on metafields (publisher, grade, key issue…), synonyms, product boosts, recommendations |
| Predictive search dropdown | **Native API** + our `<predictive-search>` | Doc 04 §5 |
| Product reviews / stars | **App** (e.g. Judge.me, Okendo, Yotpo; pick by budget) | Must write `reviews.rating` & `reviews.rating_count` standard metafields, so our own star snippet renders them. Its widget gets themed via CSS variables. |
| Wishlist ("Save to Wishlist") | **App** (v1) | Needs a JS API, so our button can drive it. Guest lists and customer sync. Shortlist 2 apps and test the API before choosing. |
| Preorders | **App using Shopify Selling Plans** (preorder/deferred-payment category) | Needs to support: charge now vs. charge on release, partial deposit, release-date display, auto-tag `preorder`, and splitting mixed carts. Shopify's own preorder offering is acceptable if it covers these. |
| Back-in-stock alerts | **App** | Triggered from the Sold Out state |
| Newsletter ("Stay in the loop") | **Native customer form + Shopify Email** (or Klaviyo if the marketing team prefers flows/segmentation) | Klaviyo adds a better "New This Week" weekly email automation |
| Pull list | **Phase 1: content page + manual process. Phase 2: custom app** (see §3) | Core differentiator for a comic shop. App Store options can be evaluated, but most are generic subscriptions. |
| Sell To Us / buylist | **Shopify Forms** (or a form app with file upload) → email/Flow → **native store credit** for payouts | Phase 2: structured buylist portal |
| Store credit | **Native store credit** | Shown in Customer Accounts. Issued manually or via Flow. |
| CGC census / cert lookup | **Links** using URL templates on the `grading_company` metaobject | No public API assumed. Just link out. |
| Collector packaging / insured shipping | **Native shipping profiles** + a shipping-protection app if insurance is sold separately | Graded slabs → a separate "Graded / Insured" shipping profile with signature-required rates over a value threshold |
| Customer accounts | **New Customer Accounts** (branded) | Order history, store credit, and (Phase 2) the pull list via a Customer Account UI Extension |
| Analytics | Shopify Analytics + GA4 via **Customer Events (web pixel)** | No GA snippets in theme code |
| Translations / currency | Shopify Markets (if shipping internationally) | Prices in local currency. Slabs may be domestic-only (a market setting). |

## 2. Automation (Shopify Flow)

| Flow | Trigger | Actions |
|---|---|---|
| **Sync issue → product** | Product created/updated | Read `comic.issue` → write `custom.release_date`, `custom.publisher`, `custom.is_key`, add tag `issue:{handle}` |
| **New This Week rotation** | Scheduled, every Wednesday 00:05 store time | Remove `new-this-week` from all products. Add it to products whose `custom.release_date` is within the last 7 days and that are active and in stock. |
| **Preorder lifecycle** | Scheduled, daily | Release date reached → remove `preorder` tag, notify staff to receive stock, (app) capture deferred payments |
| **Slab sold** | Order created containing a `Graded Comic` | Set product status to archived (or draft) after fulfilment, so sold slabs leave listings but keep their URL for SEO (redirect to the series page after N days) |
| **Duplicate cert guard** | Product created with `grading.cert_number` | Query products with the same cert → internal email/Slack alert |
| **High-value order review** | Order created, total > $500 | Tag `high-value`, require signature shipping, alert staff |
| **Buylist submission** | Form submitted (Forms) | Create a customer + tag `seller`, send acknowledgement email, notify buyer staff |

> If a Flow step can't do something (e.g. complex metaobject reads), use a small Python script on a schedule (GitHub Actions cron + Admin GraphQL API) as the fallback.

## 3. Pull list — custom app design (Phase 2)

**Goal:** customers subscribe to series. When a new issue of a subscribed series is listed, they are notified, and items are reserved or ordered per their preference.

**Domain:**

```
PullList (per customer)
 ├─ entries: [ { series: Series, cover_pref: "A" | "All" | "Variant", qty: 1..5, active: bool } ]
 └─ settings: { fulfilment: "hold-and-ship-monthly" | "ship-weekly" | "store-pickup", payment: "charge-on-release" }
```

**Architecture:**

| Piece | Tech |
|---|---|
| Storage | Customer metafield `pull_list.entries` (JSON) + a series → subscriber index in the app DB (for fan-out) |
| Storefront "Add to Pull List" button | Theme app extension block on the series page and the PDP. Talks to an **App Proxy** endpoint (`/apps/pull-list/*`), which verifies the logged-in customer via the proxy signature. |
| Management UI | **Customer Account UI Extension** (page in the account area) |
| Fan-out | Webhook `products/create` → if `comic.issue.series` has subscribers → create **draft orders** (or reserve inventory + email) per preference |
| Charging | Option 1: draft order → invoice email. Option 2: vaulted payment via subscription/selling plan (only if economically justified). |
| Stack | Shopify app template (Remix/React Router, TypeScript) on a small host (Fly.io/Render) + Postgres. Python is fine for the worker if the team prefers it, via the Admin GraphQL API. |

**Phase 1 stand-in:** the `/pages/pull-list` page explains the service and has a Shopify Form that collects the series list. Staff handle it manually and tag the customer `pull-list`. This validates demand before building the app.

## 4. Data import & catalog operations

Scripts in `scripts/` (Python 3.12, `httpx` + Admin GraphQL, `pydantic` models mirroring doc 02):

1. `setup_definitions.py`: idempotently creates all metafield definitions (with validations, storefront access = public read, filter-enabled where needed) and metaobject definitions (with web-page capability for publisher/series).
2. `import_catalog.py`: CSV/Google Sheet → validate → upsert metaobjects (publisher → series → issue → creator) → upsert products, attach media, set template suffix by product type.
3. `create_topic.py {handle}`: creates a new topic's hub collection and per-format collections with the in-stock rule (doc 11 §7.5).
4. `validate_catalog.py`: enforces the invariants in doc 02 §3.8 and reports violations as CSV.

Staff-friendly alternative for day-to-day listing: Shopify admin with metafield pinning. Each product type has its pinned metafields shown on the product form, so staff can list a slab in about 2 minutes.

## 5. App acceptance checklist (for each app)

- [ ] Installs via theme app extension / app embed. No theme file edits.
- [ ] Widget can be styled to tokens (font, colors, radius) or offers headless/API mode.
- [ ] Performance: < 30 KB extra JS, async, no CLS.
- [ ] Accessible (keyboard, labels).
- [ ] Works with New Customer Accounts.
- [ ] Data export available (no lock-in).
