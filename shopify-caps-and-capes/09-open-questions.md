# 09 — Open Questions, Gaps & Risks

## A. Decisions the business needs to make

| # | Question | Default if undecided |
|---|---|---|
| 1 | Is "Caps & Capes Comics" also a **publisher** (own imprint)? The PDP lists it as the publisher of *Aurora Knights #1*, but it isn't in the "Shop by Publisher" strip. | Treat it as a publisher metaobject with `featured = false` |
| 2 | Pull list: how should it be fulfilled and charged (hold & ship monthly, weekly, pickup)? Is there a physical store? | Phase 1 manual form, Phase 2 app |
| 3 | Preorders: charge at order time, a deposit, or charge on release? | Charge at order (simplest, fewest failed payments) |
| 4 | Ship internationally? Graded slabs too? | Domestic only at launch |
| 5 | Sell To Us: pay in cash, store credit, or both? Do store-credit payouts get a bonus %? | Store credit + cash, credit at +10% |
| 6 | Reviews app / wishlist app / email platform budget | Judge.me-class reviews, a mid-tier wishlist app, Shopify Email |
| 7 | Buy-it-now: custom styled (pixel-exact) vs. native accelerated wallets (conversion) | Custom (Option A, doc 06 §3) |
| 8 | Raw comics: are variant covers separate products or variants of one product? | **Separate products per cover** (each has its own UPC, art and SEO value). Variants only for condition. |
| 9 | What happens to sold slabs: archive, keep a "Sold" page for SEO, or redirect? | Keep as "Sold" for 90 days, then redirect to the series page |

## B. Gaps in the mockups (need design)

> First-pass designs for every item below except account pages now exist on the [design canvas](https://claude.ai/artifact/TTwTtAxNgNn18a9Syo2g8w). The About, FAQ and publisher-index pages reuse those components. Treat the canvas as a proposal for review, not as approved designs.

- **Mobile layouts** for all screens (only desktop is mocked).
- Mega menu contents and layout for COMICS / COLLECTIBLES / ACTION FIGURES.
- Collection/listing page, search results, predictive search dropdown.
- Cart drawer, cart page, empty states.
- Account pages, login (New Customer Accounts are brand-styled, not theme-built).
- Raw comic and collectible PDP variants: variant picker, collectible spec table.
- Sold out, preorder and sale states on cards and the PDP.
- Hover, focus, loading and error states for all components.
- Publisher and series landing pages, Sell To Us, Pull List, FAQ, About.
- Toasts/notifications ("Added to cart", "Saved to wishlist").

## C. Inconsistencies spotted in the mockups

| Observation | Resolution |
|---|---|
| Footer shows "© 2024". | Render the current year dynamically |
| Social row uses the old Twitter bird. | Use the X logo |
| Homepage "Featured this week" card image area and text proportions vary per card (statue cards are wider) | Standardise card image box (fixed width, `object-fit: contain`) |
| PDP "You may also like" prices for CGC 9.8 slabs vary ($49.99–$69.99) next to the $89.99 hero | Fine (real pricing varies). Content only. |
| The hero image composition overlaps the tile row | Intentional depth. Implement with a negative margin and `z-index`, and keep the tiles clickable (`pointer-events: none` on the image overflow). |
| Product art is placeholder/AI imagery with invented titles | Replace with real catalog photography before launch. Marketing art must be original or licensed. |

## D. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| "Look exactly like the mockup" with real, messier content (long titles, missing images) | Visual drift | Title convention (doc 02 §3.4), line clamping, fixed image boxes, test with the worst-case catalog early |
| App widgets break the dark aesthetic | Off-brand UI | App acceptance checklist (doc 07 §5). Prefer apps with an API/headless mode. |
| Smart collections / filters can't use some metafield types | Broken collections | Denormalised product metafields + Flow-managed tags fallback (doc 02 §3.6) |
| Performance hit from large hero composites + apps | SEO/conversion | Budgets + Lighthouse CI (doc 04 §6) |
| Unique-slab inventory oversold through simultaneous checkouts | Customer service | Inventory tracked at qty 1, "continue selling when out of stock" off, Flow alert on any negative inventory. |
| IP/trademark: using grading-company names/logos | Legal | Use names factually, link to their sites, and don't imply endorsement. Use only the logos their brand guidelines allow. |
