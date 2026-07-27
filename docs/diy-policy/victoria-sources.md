# Victoria (VIC) DIY Policy — Source Review

Policy file: `backend/policies/VIC.json`
Policy version: `2026.07.0-vic`
Date reviewed: **2026-07-18**
Status: **verified**

This document records the official Victorian sources behind every rule in the
verified VIC policy. Only Victorian Government / statutory regulator sources are
used. Blogs, trade-company sites, retailers, forums, Reddit, AI summaries and the
like are **not** used as legal authority.

## Regulators referenced
- **Energy Safe Victoria (ESV)** — electrical and gas safety.
- **Victorian Building Authority (VBA) / Building and Plumbing Commission (BPC)** —
  plumbing and building practitioner registration/licensing and building permits.
  (The VBA's plumbing/building functions are administered under the BPC; both are
  the same statutory authority and its official domains `vba.vic.gov.au` /
  `bpc.vic.gov.au` are cited.)
- **WorkSafe Victoria / Asbestos Victoria** — asbestos and work-at-height safety.

## Verification method & access caveat
Sources were checked on **2026-07-18**. Pages on `energysafe.vic.gov.au` and
`asbestos.vic.gov.au` were retrieved directly. Pages on `vba.vic.gov.au` /
`bpc.vic.gov.au` returned HTTP 403 to automated retrieval (bot protection); their
content was confirmed via the regulator's own indexed page content and titles.
Where official guidance was ambiguous, the rule is encoded **`unclear`**, never
`permitted` (see the plumbing "minor water maintenance", asbestos, unknown-material
and work-at-height rules). No broad allowances (e.g. "minor plumbing is allowed")
are encoded — each rule is task-specific.

---

## 1. Fixed electrical work · switches, power points & fixed appliances
- **Rules:** `electrical/fixed_electrical_work`, `electrical/replace_power_point`,
  `electrical/replace_light_switch`, `electrical/connect_fixed_appliance`,
  `electrical/repair_exposed_wiring`
- **DIY status:** `licensed_trade_required` (prohibited for unlicensed persons)
- **Required professional:** Licensed electrician (Registered Electrical Contractor)
- **Regulator:** Energy Safe Victoria
- **Source:** <https://www.energysafe.vic.gov.au/electrical-ddiy-dont-do-it-yourself>
- **Basis (quoted):** "Electrical work isn't a DIY job, even for small jobs such as
  changing power points or light switches." "Doing unqualified electrical work isn't
  only extremely dangerous, it's also illegal."
- **Effective date:** not stated on page · **Reviewed:** 2026-07-18

## 2. Gas fitting & gas-appliance connections
- **Rules:** `gasfitting/connect_gas_appliance`, `gasfitting/gas_pipework`
- **DIY status:** `licensed_trade_required`
- **Required professional:** Licensed gasfitter
- **Regulator:** Energy Safe Victoria
- **Source:** <https://www.energysafe.vic.gov.au/community-safety/working-tradespeople/gasfitters>
- **Basis (quoted):** "Always use a licensed gasfitter for any installation, repairs
  or renovations involving gas work" — including hot water systems, gas heaters, and
  disconnection/relocation of gas appliances.
- **Effective/updated date:** 2026-05-31 (shown on page) · **Reviewed:** 2026-07-18

## 3. Water-supply plumbing
- **Rule:** `plumbing_water_supply/water_supply_work`
- **DIY status:** `licensed_trade_required` · **Professional:** Licensed plumber
- **Regulator:** VBA / Building and Plumbing Commission
- **Source:** <https://www.vba.vic.gov.au/registration-and-licensing/plumbing-registration-and-licensing>
- **Basis:** Regulated plumbing class under the Plumbing Regulations 2018; must be
  performed by a licensed/registered plumber. Work over $750 requires a compliance
  certificate (<https://www.vba.vic.gov.au/consumers/home-renovation-essentials/plumbing-compliance-certificates>).
- **Reviewed:** 2026-07-18

## 4. Sanitary plumbing
- **Rule:** `plumbing_sanitary/sanitary_work`
- **DIY status:** `licensed_trade_required` · **Professional:** Licensed plumber
- **Regulator:** VBA / BPC
- **Source:** <https://www.vba.vic.gov.au/registration-and-licensing/plumbing-registration-and-licensing>
- **Basis:** Regulated plumbing class (Plumbing Regulations 2018). **Reviewed:** 2026-07-18

## 5. Sewerage & drainage
- **Rule:** `plumbing_drainage/sewerage_drainage_work`
- **DIY status:** `licensed_trade_required` · **Professional:** Licensed plumber
- **Regulator:** VBA / BPC
- **Source:** <https://www.vba.vic.gov.au/registration-and-licensing/plumbing-registration-and-licensing/drainage>
- **Basis (quoted):** "drainage work is the construction, installation, replacement,
  repair, alteration, maintenance, relining, testing or commissioning of any part of a
  below-ground sanitary drainage system and a below ground stormwater drainage system"
  (Part 4, Plumbing Regulations 2018). **Reviewed:** 2026-07-18

## 6. Roof plumbing & stormwater
- **Rule:** `plumbing_roofing_stormwater/roof_plumbing_stormwater_work`
- **DIY status:** `licensed_trade_required` · **Professional:** Licensed plumber
- **Regulator:** VBA / BPC
- **Source:** <https://www.vba.vic.gov.au/registration-and-licensing/plumbing-registration-and-licensing/roofing-stormwater>
- **Basis (quoted):** "roofing (stormwater) work is the construction, installation,
  replacement, repair, alteration, maintenance, testing or commissioning of any roof
  covering or roof flashing, or any part of a roof drainage system involved in the
  collection or disposal of stormwater" (Part 4, Plumbing Regulations 2018).
  Also involves work at height. **Reviewed:** 2026-07-18

## 7. Backflow prevention
- **Rule:** `plumbing_backflow/backflow_prevention_work`
- **DIY status:** `licensed_trade_required`
- **Professional:** Licensed plumber endorsed in backflow prevention
- **Regulator:** VBA / BPC
- **Source:** <https://www.vba.vic.gov.au/registration-and-licensing/plumbing-registration-and-licensing/backflow-prevention>
- **Basis (quoted):** "Only a licensed plumber with the specialist class of backflow
  prevention can conduct backflow testing independently." Requires the Water Supply
  parent class plus the backflow endorsement. **Reviewed:** 2026-07-18

## 8. Structural building work · permits & inspections
- **Rules:** `structural/structural_building_work`, `structural/repair_structural_crack`
- **DIY status:** `licensed_trade_required`
- **Required professional:** Registered building practitioner (building permit issued
  by a registered building surveyor)
- **Regulator:** VBA / BPC (Building Act 1993)
- **Sources:**
  - When is a building permit required (BP-01):
    <https://www.bpc.vic.gov.au/resource-hub/practice-notes/bp-01-when-is-a-building-permit-required>
  - What is domestic building work:
    <https://www.vba.vic.gov.au/registration-and-licensing/building-practitioner-registration/domestic-builder/what-is-domestic-building-work>
- **Basis:** Building work may not be carried out unless a building permit has been
  issued (or the work is exempt). Structural work involving load-bearing elements
  requires a permit and registered practitioners; a registered building surveyor
  issues the permit. Structural cracking must be assessed before repair.
- **Effective date:** BP-01 current 2023-12-20 · **Reviewed:** 2026-07-18

## 9. Suspected asbestos  (encoded `unclear`, never permitted)
- **Rule:** `hazardous_material/suspected_asbestos`
- **DIY status:** `unclear` — material is only suspected; identification required first
- **Required professional:** Licensed asbestos removalist (WorkSafe Victoria)
- **Regulator:** WorkSafe Victoria / Asbestos Victoria
- **Source:** <https://www.asbestos.vic.gov.au/in-the-home/find-manage-remove-dispose/homeowner-removal>
- **Basis (quoted):** "Asbestos removal work is best performed by licensed asbestos
  removalists, who are appropriately trained to perform the removal work safely."
  Friable asbestos and larger non-friable quantities must be removed by a licensed
  removalist. Because the material is only *suspected*, the legal status is `unclear`
  pending identification, with strong safety caution.
- **Effective/updated date:** 2024-06-11 · **Reviewed:** 2026-07-18

## 10. Cosmetic, non-structural finishes — painting & plaster  (`permitted`, narrow)
- **Rules:** `cosmetic_finishes/painting`, `cosmetic_finishes/cosmetic_plaster_repair`
- **DIY status:** `permitted` (narrow, with structural/asbestos exclusions)
- **Regulator:** VBA / BPC
- **Source:** BP-01 When is a building permit required
  <https://www.bpc.vic.gov.au/resource-hub/practice-notes/bp-01-when-is-a-building-permit-required>
- **Basis:** Repair, renewal or maintenance of part of an existing building is exempt
  from requiring a building permit, and painting/minor non-structural patching is not
  a licensed occupation in Victoria. Owners must still comply with building
  regulations. **Exclusions encoded:** any electrical/plumbing/gas/structural work;
  cracks indicating structural movement; and any surface that may contain asbestos or
  lead paint (pre-1990). **Effective date:** BP-01 current 2023-12-20 · **Reviewed:** 2026-07-18

## 11. Minor water-related maintenance  (encoded `unclear`)
- **Rule:** `plumbing/minor_water_maintenance`
- **DIY status:** `unclear` (deliberately not a broad "minor plumbing allowed" rule)
- **Regulator:** VBA / BPC
- **Source:** <https://www.vba.vic.gov.au/consumers/home-renovation-essentials/engaging-plumber>
- **Basis:** Most plumbing work must be done by a licensed plumber. Whether a specific
  minor task (e.g. replacing a tap washer) is exempt is not clearly defined in the
  accessible official guidance, so it is encoded `unclear` — confirm with the VBA.
  **Reviewed:** 2026-07-18

## 12. Work at height  (encoded `unclear` — safety, not a homeowner licence)
- **Rule:** `work_at_height/elevated_work`
- **DIY status:** `unclear` — for a homeowner this is a safety consideration, not a
  licensing question; WorkSafe duties apply where others are engaged.
- **Regulator:** WorkSafe Victoria
- **Source:** <https://www.worksafe.vic.gov.au/prevent-falls>
- **Basis:** Falls from height are a leading cause of serious injury; use proper
  fall-prevention and consider a professional for roof-level work. **Reviewed:** 2026-07-18

---

## Review & maintenance
- Re-review at least every 12 months, or sooner if a cited regulator updates its
  guidance or the underlying Acts/Regulations change.
- On any change, bump `policy_version`, update `last_reviewed_at`, and re-run
  `backend/tests/`.
- Other jurisdictions (ACT, NSW, NT, QLD, SA, TAS, WA) remain unverified placeholders
  (`legal_status: unclear`) until researched to this same standard.
