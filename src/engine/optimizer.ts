/**
 * Plan builder: turns a product list + box catalogue into a concrete packing plan.
 *
 * The search is a deterministic multi-start heuristic:
 *   1. Generate several candidate item orderings (large-first, weight-first,
 *      longest-side-first, area-first, ...).
 *   2. For each ordering, greedily fill boxes using "best fit" box selection:
 *      at every step pick the box type that consumes the most remaining volume
 *      per unit of box cost, so we never pay for a box we barely use.
 *   3. Keep the best plan by (box count, cost, wasted volume).
 *
 * No randomness, no time-dependent decisions => identical inputs always produce
 * an identical plan.
 */

import { EPS, boxVolume, itemVolume, orientations, volume, fits } from './geometry';
import { boxCanFit, packBox } from './packer';
import type {
  BaselineMetrics,
  BoxType,
  ItemInstance,
  Metrics,
  OptimizationResult,
  OptimizationSettings,
  PackedBox,
  Product,
} from './types';
import { DEFAULT_SETTINGS } from './types';

export function expandProducts(products: Product[]): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const p of products) {
    const qty = Math.max(0, Math.floor(p.quantity || 0));
    for (let i = 0; i < qty; i++) {
      out.push({
        uid: `${p.id}#${i}`,
        productId: p.id,
        sku: p.sku,
        name: p.name,
        length: p.length,
        width: p.width,
        height: p.height,
        weight: p.weight,
      });
    }
  }
  return out;
}

type Ordering = (a: ItemInstance, b: ItemInstance) => number;

/** Cardboard surface of a box in cm^2 (used for waste estimates). */
function cardboardArea(b: { length: number; width: number; height: number }): number {
  return 2 * (b.length * b.width + b.width * b.height + b.length * b.height);
}

const maxSide = (i: ItemInstance) => Math.max(i.length, i.width, i.height);

const ORDERINGS: { name: string; cmp: Ordering }[] = [
  // Volume descending — classic FFD, the strongest single heuristic.
  {
    name: 'volume-desc',
    cmp: (a, b) =>
      itemVolume(b) - itemVolume(a) || maxSide(b) - maxSide(a) || a.sku.localeCompare(b.sku),
  },
  // Longest side descending — good for long/thin items.
  {
    name: 'longest-side-desc',
    cmp: (a, b) => maxSide(b) - maxSide(a) || itemVolume(b) - itemVolume(a) || a.sku.localeCompare(b.sku),
  },
  // Surface area descending — hugs walls better.
  {
    name: 'area-desc',
    cmp: (a, b) => surface(a) - surface(b) || itemVolume(b) - itemVolume(a) || a.sku.localeCompare(b.sku),
  },
  // Heaviest first — respects weight limits early.
  {
    name: 'weight-desc',
    cmp: (a, b) => b.weight - a.weight || itemVolume(b) - itemVolume(a) || a.sku.localeCompare(b.sku),
  },
  // Reverse volume — a useful diversification pass for mixed catalogues.
  {
    name: 'volume-asc',
    cmp: (a, b) => itemVolume(a) - itemVolume(b) || a.sku.localeCompare(b.sku),
  },
];

function surface(i: ItemInstance): number {
  return 2 * (i.length * i.width + i.width * i.height + i.length * i.height);
}

/** Assign a distinct id if the caller omitted one. */
function normaliseProducts(products: Product[]): Product[] {
  return products.map((p, i) => ({ ...p, id: p.id || `p${i}` }));
}

/**
 * Greedy multi-box plan for a single item ordering.
 *
 * Re-evaluating every box type against the entire remaining list for every box
 * is what made this quadratic in practice. Instead we pick the best-scoring box
 * type once and keep filling with it, only re-running the comparison when that
 * type can no longer accept any remaining item. Same decisions, far cheaper.
 */
function buildPlan(
  items: ItemInstance[],
  boxes: BoxType[],
  settings: OptimizationSettings,
  cmp: Ordering,
): PackedBox[] {
  const remaining = items.slice().sort(cmp);
  const plan: PackedBox[] = [];
  let index = 0;

  const maxWeightOf = (b: BoxType) => b.weightLimit * settings.weightUtilizationLimit;

  // Smallest volume first: cheap boxes are tried first and win ties.
  const ordered = boxes.slice().sort((a, b) => {
    const va = boxVolume(a.length, a.width, a.height);
    const vb = boxVolume(b.length, b.width, b.height);
    return va - vb || a.cost - b.cost || a.code.localeCompare(b.code);
  });

  const packWith = (box: BoxType) =>
    packBox(box, remaining, {
      allowRotation: settings.allowRotation,
      maxWeight: maxWeightOf(box),
      maxItems: settings.maxItemsPerBox,
    });

  // A box type can only be useful if it can physically hold at least one of the
  // remaining items. (Earlier this was incorrectly filtered against the single
  // largest remaining item, which forced every box to one oversized type: a long
  // item needs *one* big box, not every box.)
  const canTakeSomething = (box: BoxType): boolean => {
    const maxW = maxWeightOf(box);
    for (const it of remaining) {
      if (it.weight <= maxW + EPS && boxCanFit(box, it, settings.allowRotation)) return true;
    }
    return false;
  };

  const makeBox = (box: BoxType, result: ReturnType<typeof packBox>): PackedBox => {
    const boxVol = boxVolume(box.length, box.width, box.height);
    return {
      index: index++,
      boxTypeId: box.id,
      boxCode: box.code,
      length: box.length,
      width: box.width,
      height: box.height,
      weightLimit: maxWeightOf(box),
      cost: box.cost,
      placements: result.placements,
      weight: result.weight,
      usedVolume: result.usedVolume,
      boxVolume: boxVol,
      utilization: result.usedVolume / boxVol,
    };
  };

  const removePlaced = (result: ReturnType<typeof packBox>): void => {
    const placed = new Set(result.placements.map((p) => p.uid));
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (placed.has(remaining[i].uid)) remaining.splice(i, 1);
    }
  };

  while (remaining.length > 0) {
    const candidates = ordered.filter(canTakeSomething);
    if (candidates.length === 0) break; // nothing left fits anywhere

    let chosen: { box: BoxType; result: ReturnType<typeof packBox>; score: number } | null = null;

    for (const box of candidates) {
      const result = packWith(box);
      if (result.placements.length === 0) continue;
      // Effective cost of the box: material cost plus a volumetric charge.
      // Carriers bill by dimensional weight, so empty space inside a box is a
      // real cost, not just cardboard. Optimising material cost alone would
      // happily fill huge boxes with air whenever a big box is cheaper per m2.
      const eff = box.cost + settings.shippingCostPerM3 * (boxVolume(box.length, box.width, box.height) / 1_000_000);
      // Minimise effective cost per unit of item volume packed.
      const score = -(eff / Math.max(result.usedVolume, 1e-6));
      if (!chosen || score > chosen.score + EPS) {
        chosen = { box, result, score };
      }
    }

    if (!chosen) break;

    plan.push(makeBox(chosen.box, chosen.result));
    removePlaced(chosen.result);
  }

  return plan;
}

export function computeMetrics(boxes: PackedBox[], itemsPlaced: number): Metrics {
  let boxVol = 0;
  let itemVol = 0;
  let weight = 0;
  let cost = 0;
  for (const b of boxes) {
    boxVol += b.boxVolume;
    itemVol += b.usedVolume;
    weight += b.weight;
    cost += b.cost;
  }
  return {
    boxes: boxes.length,
    boxVolume: boxVol,
    itemVolume: itemVol,
    utilization: boxVol > 0 ? itemVol / boxVol : 0,
    totalWeight: weight,
    boxCost: cost,
    cardboardArea: boxes.reduce((s, b) => s + cardboardArea(b), 0) / 10_000,
    costPerItem: itemsPlaced > 0 ? cost / itemsPlaced : 0,
    itemsPlaced,
  };
}

/**
 * Baseline = one box per item, picking the cheapest box each item fits in.
 * This is what most teams do by hand when they ship each order separately.
 */
export function computeBaseline(
  items: ItemInstance[],
  boxes: BoxType[],
  allowRotation: boolean,
): BaselineMetrics {
  const ordered = boxes.slice().sort((a, b) => {
    const va = boxVolume(a.length, a.width, a.height);
    const vb = boxVolume(b.length, b.width, b.height);
    return va - vb || a.cost - b.cost || a.code.localeCompare(b.code);
  });

  let boxVol = 0;
  let itemVol = 0;
  let weight = 0;
  let cost = 0;
  let count = 0;
  let placed = 0;
  let area = 0;

  for (const item of items) {
    const vol = itemVolume(item);
    itemVol += vol;
    weight += item.weight;
    const box = ordered.find((b) => boxCanFit(b, item, allowRotation) && b.weightLimit >= item.weight);
    if (box) {
      boxVol += boxVolume(box.length, box.width, box.height);
      area += cardboardArea(box);
      cost += box.cost;
      count++;
      placed++;
    }
  }

  return {
    boxes: count,
    boxVolume: boxVol,
    itemVolume: itemVol,
    utilization: boxVol > 0 ? itemVol / boxVol : 0,
    totalWeight: weight,
    boxCost: cost,
    cardboardArea: area / 10_000,
    costPerItem: placed > 0 ? cost / placed : 0,
    itemsPlaced: placed,
  };
}

export interface OptimizeInput {
  products: Product[];
  boxes: BoxType[];
  settings?: Partial<OptimizationSettings>;
}

/** Monotonic clock that works in both Node (tests) and the browser. */
const now: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

export function optimize(input: OptimizeInput): OptimizationResult {
  const started = now();
  const settings: OptimizationSettings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };
  const errors: string[] = [];
  const warnings: string[] = [];

  const products = normaliseProducts(input.products ?? []);
  const boxes = (input.boxes ?? []).filter(
    (b) => b.length > 0 && b.width > 0 && b.height > 0 && b.cost >= 0,
  );

  if (products.length === 0) errors.push('Add at least one product to optimise.');
  if (boxes.length === 0) errors.push('Add at least one box size to your catalogue.');
  if (errors.length) {
    return {
      ok: false, errors, warnings, boxes: [], metrics: null, baseline: null, savings: null,
      elapsedMs: now() - started,
    };
  }

  const items = expandProducts(products);
  if (items.length === 0) {
    errors.push('Every product has a quantity of 0 — nothing to pack.');
    return {
      ok: false, errors, warnings, boxes: [], metrics: null, baseline: null, savings: null,
      elapsedMs: now() - started,
    };
  }

  // Warn about items that cannot fit in any box at all.
  const oversized = items.filter(
    (it) => !boxes.some((b) => boxCanFit(b, it, settings.allowRotation)),
  );
  if (oversized.length) {
    const skus = new Set(oversized.map((o) => o.sku));
    warnings.push(
      `${oversized.length} item(s) [${[...skus].join(', ')}] do not fit any available box and were skipped.`,
    );
  }

  const baseline = computeBaseline(items, boxes, settings.allowRotation);

  let best: PackedBox[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const depth = Math.max(1, settings.searchDepth);
  const candidates = ORDERINGS.slice(0, Math.min(depth, ORDERINGS.length));

  for (const { cmp } of candidates) {
    const plan = buildPlan(items, boxes, settings, cmp);
    if (!plan.length) continue;
    const metrics = computeMetrics(plan, countPlaced(plan));
    const planShipping =
      settings.shippingCostPerM3 * (metrics.boxVolume / 1_000_000);
    // Rank by total delivered cost (cardboard + volumetric shipping) first,
    // then by fewer boxes, then by better utilisation.
    const score =
      (metrics.boxCost + planShipping) * 1e6 +
      metrics.cardboardArea * 1e3 +
      metrics.boxes * 1e-3 +
      (1 - metrics.utilization);
    if (score < bestScore - EPS) {
      bestScore = score;
      best = plan;
    }
  }

  if (!best) {
    errors.push('Could not pack any item into any box. Check dimensions and rotation settings.');
    return {
      ok: false, errors, warnings, boxes: [], metrics: null, baseline, savings: null,
      elapsedMs: now() - started,
    };
  }

  const metrics = computeMetrics(best, countPlaced(best));

  const unplaced = items.length - metrics.itemsPlaced;
  if (unplaced > 0) {
    warnings.push(`${unplaced} item(s) could not be packed into the selected boxes.`);
  }

  const savings = baseline && baseline.boxes > 0
    ? (() => {
        const optShipping = settings.shippingCostPerM3 * (metrics.boxVolume / 1_000_000);
        const baseShipping = settings.shippingCostPerM3 * (baseline.boxVolume / 1_000_000);
        const optTotal = metrics.boxCost + optShipping;
        const baseTotal = baseline.boxCost + baseShipping;
        return {
          boxesSaved: baseline.boxes - metrics.boxes,
          boxesSavedPct: baseline.boxes > 0
            ? ((baseline.boxes - metrics.boxes) / baseline.boxes) * 100
            : 0,
          volumeSavedPct: baseline.boxVolume > 0
            ? ((baseline.boxVolume - metrics.boxVolume) / baseline.boxVolume) * 100
            : 0,
          costSaved: baseTotal - optTotal,
          costSavedPct: baseTotal > 0 ? ((baseTotal - optTotal) / baseTotal) * 100 : 0,
          materialSaved: baseline.boxCost - metrics.boxCost,
          shippingSaved: baseShipping - optShipping,
          /** Cardboard surface used by the optimised plan, in m2. */
          cardboardAreaM2: metrics.cardboardArea,
          /** Cardboard surface the naive one-item-per-box plan would need, in m2. */
          baselineCardboardAreaM2: baseline.cardboardArea,
        };
      })()
    : null;

  return {
    ok: true,
    errors,
    warnings,
    boxes: best,
    metrics,
    baseline,
    savings,
    elapsedMs: now() - started,
  };
}

function countPlaced(boxes: PackedBox[]): number {
  let n = 0;
  for (const b of boxes) n += b.placements.length;
  return n;
}

/** Physical units only — never affects the plan, used for display/estimation. */
export { cardboardArea };

/** Total cardboard surface across a plan, in square metres. */
export function planCardboardArea(boxes: PackedBox[]): number {
  return boxes.reduce((sum, b) => sum + cardboardArea(b), 0) / 10_000;
}

/** Volume occupied but unused by items, in cm^3. */
export function wastedVolume(boxes: PackedBox[]): number {
  return boxes.reduce((sum, b) => sum + (b.boxVolume - b.usedVolume), 0);
}

export { orientations, volume, fits };