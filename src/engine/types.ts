/**
 * PackIQ core types.
 * All physical units: centimetres (cm) and kilograms (kg).
 */

export interface Product {
  /** Stable unique id (generated). */
  id: string;
  sku: string;
  name: string;
  /** Single-item dimensions in cm. */
  length: number;
  width: number;
  height: number;
  /** Single-item weight in kg. */
  weight: number;
  /** Number of identical units to pack. */
  quantity: number;
}

export interface BoxType {
  id: string;
  code: string;
  /** Inner dimensions in cm. */
  length: number;
  width: number;
  height: number;
  /** Max gross weight in kg. */
  weightLimit: number;
  /** Cost of the empty box in currency units. */
  cost: number;
}

/** A resolved item instance ready to be placed (one product unit). */
export interface ItemInstance {
  /** Unique per unit: `${productId}#${index}`. */
  uid: string;
  productId: string;
  sku: string;
  name: string;
  length: number;
  width: number;
  height: number;
  weight: number;
}

/** Placement of one item inside a box, in box-local cm coordinates. */
export interface Placement {
  uid: string;
  productId: string;
  sku: string;
  name: string;
  /** Min corner (cm from box origin). */
  x: number;
  y: number;
  z: number;
  /** Placed extents along x/y/z (already rotated). */
  dx: number;
  dy: number;
  dz: number;
  weight: number;
  /** Rotation applied to the product, for display/debugging. */
  rotation: Rotation;
}

export type Rotation = 'XY' | 'XZ' | 'YX' | 'YZ' | 'ZX' | 'ZY';

export interface PackedBox {
  /** Index of this box within the plan. */
  index: number;
  boxTypeId: string;
  boxCode: string;
  /** Box inner dims. */
  length: number;
  width: number;
  height: number;
  weightLimit: number;
  cost: number;
  placements: Placement[];
  /** Sum of item weights. */
  weight: number;
  /** Sum of item volumes. */
  usedVolume: number;
  /** Box internal volume. */
  boxVolume: number;
  /** usedVolume / boxVolume, 0..1. */
  utilization: number;
}

export interface OptimizationSettings {
  /** Allow items to be rotated. */
  allowRotation: boolean;
  /** Maximum box weight, as a multiplier over the box's own weightLimit (0..1). */
  weightUtilizationLimit: number;
  /** Aim for this average utilization when choosing box counts (0..1). */
  targetUtilization: number;
  /**
   * Deterministic search budget: how many candidate orderings to evaluate.
   * 1 = fastest, 5 = exhaustive. On mixed catalogues 2 is consistently the
   * sweet spot, so higher values rarely repay their extra runtime.
   */
  searchDepth: number;
  /** Max number of items to load per box (guards pathological inputs). */
  maxItemsPerBox: number;
  /**
   * Volumetric shipping charge per cubic metre of box, in the same currency
   * units as `BoxType.cost`. Carriers bill by dimensional weight, so this is
   * what stops the optimizer from choosing huge boxes and filling them with air.
   */
  shippingCostPerM3: number;
}

export const DEFAULT_SETTINGS: OptimizationSettings = {
  allowRotation: true,
  weightUtilizationLimit: 1,
  targetUtilization: 0.85,
  searchDepth: 2,
  maxItemsPerBox: 9999,
  // ~ a small parcel rate per m3: large boxes are cheap per m2 of cardboard but
  // expensive once volumetric shipping is counted.
  shippingCostPerM3: 6,
};

/** Aggregate impact of a packing plan. */
export interface Metrics {
  boxes: number;
  /** Total internal volume of all boxes used (cm^3). */
  boxVolume: number;
  /** Total volume occupied by items (cm^3). */
  itemVolume: number;
  /** itemVolume / boxVolume. */
  utilization: number;
  totalWeight: number;
  boxCost: number;
  /** Total cardboard surface of all boxes used, in m2. */
  cardboardArea: number;
  /** Cost per unit volume, useful for comparing box mixes. */
  costPerItem: number;
  itemsPlaced: number;
}

/** What a naive/non-optimized approach would have achieved. */
export interface BaselineMetrics extends Metrics {
  /** One box per item (the worst realistic case). */
  boxes: number;
  boxVolume: number;
  utilization: number;
  boxCost: number;
}

export interface OptimizationResult {
  ok: boolean;
  /** Human-readable reasons when ok === false. */
  errors: string[];
  /** Non-fatal warnings (e.g. oversized items). */
  warnings: string[];
  boxes: PackedBox[];
  metrics: Metrics | null;
  baseline: BaselineMetrics | null;
  /** Savings vs baseline. */
  savings: {
    /** Absolute number of boxes avoided vs the baseline. */
    boxesSaved: number;
    boxesSavedPct: number;
    /** Percentage of shipping volume avoided. */
    volumeSavedPct: number;
    /** Total delivered cost avoided (cardboard + volumetric shipping). */
    costSaved: number;
    costSavedPct: number;
    /** Cardboard cost avoided. */
    materialSaved: number;
    /** Volumetric shipping cost avoided. */
    shippingSaved: number;
    /** Cardboard surface used by the optimized plan, in m2. */
    cardboardAreaM2: number;
    /** Cardboard surface the naive plan would need, in m2. */
    baselineCardboardAreaM2: number;
  } | null;
  /** Milliseconds spent optimizing. */
  elapsedMs: number;
}