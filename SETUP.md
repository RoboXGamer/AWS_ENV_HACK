# PackIQ — Setup & Reference

Operational details for [PackIQ](./README.md). Kept separate so the main README
stays short.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production build
npm test         # engine test suite
```

The app loads a demo dataset on first run, so there is something to look at
immediately.

## CSV formats

Column names are matched case-insensitively and common suffixes are tolerated,
so exported files from warehouse tools usually import without editing.

**Products** (`sku, name, length, width, height, weight, quantity`):

```csv
sku,name,length_cm,width_cm,height_cm,weight_kg,quantity
SKU-1001,Wireless Earbuds,8,6,4,0.15,40
```

**Boxes** (`code, length, width, height, weightLimit, cost`):

```csv
code,length_cm,width_cm,height_cm,weight_limit_kg,cost
S-MAILER,25,18,10,5,0.30
```

Units are centimetres and kilograms. Box dimensions are *inner* dimensions.

## Project layout

```
src/engine/     Pure, framework-free optimization engine
  types.ts           Shared types + default settings
  geometry.ts        Rotations, AABB overlap, contact scoring
  packer.ts          Single-box packer (anchor points)
  optimizer.ts       Multi-box planning, baseline, savings
  optimizer.worker.ts  Web worker wrapper
  csv.ts             Import / export
  sampleData.ts      Demo catalogue
  *.test.ts          Test suite
src/components/ UI (dashboard, editors, 3D viewer)
src/state/      React store, localStorage persistence, worker plumbing
```

The engine has no DOM or React dependencies, which is what lets the same code
run in the worker and under Vitest.

## Settings

All settings are exposed in the **Settings** tab and affect the deterministic
engine:

- **Allow item rotation** — try all 6 axis alignments
- **Weight limit usage** — fraction of each box's max gross weight
- **Search depth** — how many candidate orderings to evaluate (1 fastest, 5 exhaustive)
- **Volumetric shipping rate** — cost per m³ of box volume

### Why volumetric cost matters

Ranking plans by cardboard cost alone is misleading: if a large box happens to be
cheaper per m², a cost-only optimizer will happily fill huge boxes with air.
Carriers bill by dimensional weight, so `shippingCostPerM3` is included in the
objective to reflect that empty space has a real cost.

## Deployment

Intended target is S3 + CloudFront, which sits inside AWS's always-free
allowances at zero monthly cost:

- **S3** — static hosting (5 GB storage free)
- **CloudFront** — CDN (50 GB egress/month free)
- **ACM certificate** — free, auto-renewing

Avoid Route 53 (~$0.50/month per hosted zone) by using the default
`*.cloudfront.net` domain, or buy a domain elsewhere at a lower price.

> **Billing trap:** hosting a static site requires disabling S3 "Block Public
> Access". Do this deliberately, and set an AWS Budget alarm at a $1 threshold.

Do not rely on AWS free-tier credits for this project — they expire after six
months. The always-free allowances above do not.

## Notes and limitations

- Volumes are measured from the given outer box dimensions; the plan does not
  account for internal padding, cushioning, or stacking of the boxes themselves.
- Cost and shipping figures are estimates for comparing plans, not for invoicing.
- The optimizer is a strong heuristic, not an exact solver. It explores multiple
  item orderings but does not backtrack over placements or box combinations, so it
  offers no optimality guarantee.
- Every product is currently treated as a rigid cuboid that may rotate freely.
  Fragility, cushioning requirements, stacking limits and orientation
  restrictions are not modelled.
- Shipping cost is approximated as `box volume × rate`. Real carrier pricing uses
  the greater of actual and dimensional weight, per-carrier divisors, weight
  slabs and surcharges — none of which are modelled yet.