---
version: 1
slug: "app-portal-campaigns-page-jsx"
primary_target: "app/(portal)/campaigns/page.jsx"
related_targets: ["app/(portal)/offers/page.jsx","design/promotions.html"]
---

# Surface brief: Promotions (/campaigns) and Offers (/offers)

Mode: Operate. Inherits the Clean Console world (DESIGN.md); no new tokens.

Audience and job: owners and outlet managers take up ready-made NETS promotions (4 weeks, one per payment type per outlet, Stop) and NETS offers, and see what finished promotions did; accountants and head office look only. Spec: docs/superpowers/specs/2026-11-24-offers-promotions-design.md. Chosen layout: option A (design/promotions.html), seed 69023c37. Offers follows the same pattern.

## Direction contract

THESIS: Promotions are deals you switch on, not campaigns you write: a grid of ready-made cards filtered by payment type, the running one pinned with its 4-week progress, results as honest estimates; refuses a campaign-builder form.
OWN-WORLD: Clean Console: cool-paper page, white 12px cards, hairlines, Inter, blue for data and progress, Take up white with a blue outline, the panel's start button the one red action, green/grey/red only in result labels.
STORY: The merchant reads one sentence (what is running, what the last one did), taps Take up, picks outlets in a panel that slides in from the right without leaving the page, and starts it; later they read the result row.
FIRST VIEWPORT: Title + Marketing campaigns subtitle; answer sentence with the last result in blue; Running now card with payment type, outlets, pill, 4-week bar and Stop; the first row of promotion cards with filter chips visible at 1280×800.
FORM: Cards with payment-type filters, my seventh-ranked structure; dealt as THE ROLL, seed key 69023c37.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: Take up slides the panel in from the right over a dimmed page; outlets that cannot run it are greyed with the reason; starting closes the panel and the new card slides into Running now (all off under reduced motion).
