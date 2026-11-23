---
version: 1
slug: "app-portal-disputes-page-jsx"
primary_target: "app/(portal)/disputes/page.jsx"
related_targets: ["design/refunds.html"]
---

# Surface brief: Refunds & disputes (/disputes)

Mode: Operate. Inherits the Clean Console world (DESIGN.md); no new tokens.

Audience and job: merchant owners and outlet managers see refunds and disputes and answer chargebacks (Accept / Decline with evidence) before the deadline; accountants and franchise head office look only. Spec: docs/superpowers/specs/2026-11-23-refunds-disputes-design.md. Chosen layout: option A (design/refunds.html), seed 061e37a9.

## Direction contract

THESIS: Each dispute is a case that shows where it stands (customer disputed, your answer, NETS decides) and what to do now; refuses a flat table of chargebacks with a status column.
OWN-WORLD: Clean Console: cool-paper page, white 12px panels, hairlines, Inter, blue for data and progress, red only for the open case, Decline and the send button; Accept is white with a blue outline.
STORY: The merchant reads one sentence (what needs an answer, by when, how much is held), opens the case, reads the hint, and declines with proof or accepts in under a minute.
FIRST VIEWPORT: Title + Chargebacks subtitle; answer sentence with the held amount in blue; three-part summary strip; the open case with its 3-step track, blue hint box, red Decline and outlined Accept within the first 800px on desktop.
FORM: Case cards with a 3-step track, fifth on my list of seven ranked structures; dealt as THE ROLL, seed key 061e37a9.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: Decline expands the form inside the case and the track's current step moves from "Your answer" to "NETS decides" after sending (expand and step change animate; off under reduced motion).
