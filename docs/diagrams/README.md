# Diagrams for the technical document

Mermaid sources (`*.mmd`) and the PNGs placed in `docs/NETS-Merchant-Portal-Technical-Document.docx` (v1.1):

| File | Figure |
|---|---|
| `usecases` | Figure 2, use cases (section 3) |
| `tiers` | Figure 7, NETS identifier hierarchy MID → TID → STAN (8.1) |
| `erd-org` | Figure 8, organisation and access (8.3) |
| `erd-money` | Figure 9, payments and money (8.4) |
| `erd-recon` | Figure 10, check-up (8.5) |
| `erd-security` | Figure 11, logins, alerts and help (8.6) |

To change one: edit the `.mmd`, render it at 3x scale (for example at https://mermaid.live, or Mermaid 11 in a browser), and replace the picture in Word. Keep the ERDs in step with `db/migrations/`.
