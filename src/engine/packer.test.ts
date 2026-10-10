import { describe, expect, it } from 'vitest';
import { boxCanFit, packBox } from './packer';
import { orientations } from './geometry';
import { computeBaseline, optimize, expandProducts } from './optimizer';
import { parseBoxesCsv, parseProductsCsv, productsToCsv } from './csv';
import { DEMO_BOXES, DEMO_PRODUCTS } from './sampleData';
import type { BoxType, Product } from './types';

const box = (over: Partial<BoxType> = {}): BoxType => ({
  id: 'b', code: 'B', length: 10, width: 10, height: 10, weightLimit: 100, cost: 1, ...over,
});

const prod = (over: Partial<Product> = {}): Product => ({
  id: 'p', sku: 'S', name: 'N', length: 5, width: 5, height: 5, weight: 1, quantity: 1, ...over,
});

describe('geometry', () => {
  it('de-duplicates rotations for cubes', () => {
    expect(orientations(5, 5, 5)).toHaveLength(1);
    expect(orientations(5, 4, 3)).toHaveLength(6);
  });
});

describe('packer', () => {
  it('fills a cube exactly with eight half-cubes', () => {
    const b = box({ length: 10, width: 10, height: 10 });
    const items = Array.from({ length: 8 }, (_, i) => ({
      uid: `i${i}`, productId: 'p', sku: 'S', name: 'N', length: 5, width: 5, height: 5, weight: 1,
    }));
    const res = packBox(b, items, { allowRotation: true, maxWeight: 100 });
    expect(res.placements).toHaveLength(8);
    expect(res.usedVolume).toBeCloseTo(b.length * b.width * b.height, 6);
  });

  it('never overlaps placements', () => {
    const b = box({ length: 20, width: 15, height: 12 });
    const items = Array.from({ length: 20 }, (_, i) => ({
      uid: `i${i}`, productId: 'p', sku: 'S', name: 'N',
      length: 6 + (i % 3), width: 4 + (i % 2), height: 3, weight: 0.5,
    }));
    const { placements } = packBox(b, items, { allowRotation: true, maxWeight: 100 });
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const c = placements[j];
        const hit =
          a.x < c.x + c.dx && c.x < a.x + a.dx &&
          a.y < c.y + c.dy && c.y < a.y + a.dy &&
          a.z < c.z + c.dz && c.z < a.z + a.dz;
        expect(hit).toBe(false);
      }
    }
  });

  it('keeps every placement inside the box bounds', () => {
    const b = box({ length: 30, width: 20, height: 15 });
    const items = Array.from({ length: 12 }, (_, i) => ({
      uid: `i${i}`, productId: 'p', sku: 'S', name: 'N',
      length: 7 + i, width: 5, height: 4, weight: 1,
    }));
    const { placements } = packBox(b, items, { allowRotation: true, maxWeight: 50 });
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.z).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x + p.dx).toBeLessThanOrEqual(b.length + 1e-6);
      expect(p.y + p.dy).toBeLessThanOrEqual(b.width + 1e-6);
      expect(p.z + p.dz).toBeLessThanOrEqual(b.height + 1e-6);
    }
  });

  it('respects the weight limit', () => {
    const b = box({ length: 100, width: 100, height: 100, weightLimit: 5 });
    const items = Array.from({ length: 10 }, (_, i) => ({
      uid: `i${i}`, productId: 'p', sku: 'S', name: 'N', length: 10, width: 10, height: 10, weight: 2,
    }));
    const { placements, weight } = packBox(b, items, { allowRotation: true, maxWeight: 5 });
    expect(weight).toBeLessThanOrEqual(5 + 1e-6);
    expect(placements.length).toBeLessThanOrEqual(2);
  });

  it('is deterministic for identical input', () => {
    const b = box({ length: 40, width: 30, height: 20 });
    const items = Array.from({ length: 15 }, (_, i) => ({
      uid: `i${i}`, productId: 'p', sku: `S${i}`, name: 'N',
      length: 5 + (i % 5), width: 4, height: 3, weight: 1,
    }));
    const a = packBox(b, items, { allowRotation: true, maxWeight: 50 });
    const c = packBox(b, items, { allowRotation: true, maxWeight: 50 });
    expect(JSON.stringify(a.placements)).toBe(JSON.stringify(c.placements));
  });

  it('detects items that do not fit any box', () => {
    expect(boxCanFit(box(), { uid: 'i', productId: 'p', sku: 'S', name: 'N', length: 4, width: 4, height: 4, weight: 1 }, true)).toBe(true);
    expect(boxCanFit(box(), { uid: 'i', productId: 'p', sku: 'S', name: 'N', length: 11, width: 4, height: 4, weight: 1 }, true)).toBe(false);
  });
});

describe('optimizer', () => {
  it('packs one product into exactly one box', () => {
    const res = optimize({ products: [prod({ quantity: 1 })], boxes: [box()] });
    expect(res.ok).toBe(true);
    expect(res.metrics!.boxes).toBe(1);
  });

  it('consolidates many items into fewer boxes than the baseline', () => {
    const products = Array.from({ length: 6 }, (_, i) =>
      prod({ id: `p${i}`, sku: `S${i}`, length: 5, width: 4, height: 3, quantity: 8 }),
    );
    const boxes = [box({ id: 'b1', code: 'M', length: 20, width: 20, height: 20, cost: 1 })];
    const res = optimize({ products, boxes });
    expect(res.ok).toBe(true);
    expect(res.metrics!.itemsPlaced).toBe(48);
    expect(res.metrics!.boxes).toBeLessThan(res.baseline!.boxes);
    expect(res.savings!.boxesSaved).toBeGreaterThan(0);
    // 48 items of 60cm3 in a 8000cm3 box: all of them fit in one box, so the
    // box count is already optimal (1) even though utilisation is modest.
    expect(res.metrics!.boxes).toBe(1);
    expect(res.metrics!.utilization).toBeCloseTo((48 * 60) / 8000, 3);
  });

  it('never exceeds box volume across the plan', () => {
    const res = optimize({ products: DEMO_PRODUCTS, boxes: DEMO_BOXES });
    expect(res.ok).toBe(true);
    for (const b of res.boxes) {
      expect(b.usedVolume).toBeLessThanOrEqual(b.boxVolume + 1e-6);
      expect(b.weight).toBeLessThanOrEqual(b.weightLimit + 1e-6);
      expect(b.utilization).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('packs every item of the demo catalogue', () => {
    const res = optimize({ products: DEMO_PRODUCTS, boxes: DEMO_BOXES });
    const total = expandProducts(DEMO_PRODUCTS).length;
    expect(res.metrics!.itemsPlaced).toBe(total);
  });

  it('reports errors for empty input', () => {
    expect(optimize({ products: [], boxes: [box()] }).ok).toBe(false);
    expect(optimize({ products: [prod()], boxes: [] }).ok).toBe(false);
  });

  it('warns when an item fits no box', () => {
    const res = optimize({
      products: [prod({ length: 100, width: 100, height: 100 })],
      boxes: [box()],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('is fully deterministic across repeated runs', () => {
    const a = optimize({ products: DEMO_PRODUCTS, boxes: DEMO_BOXES });
    const b = optimize({ products: DEMO_PRODUCTS, boxes: DEMO_BOXES });
    expect(JSON.stringify(a.boxes)).toBe(JSON.stringify(b.boxes));
    expect(a.metrics).toEqual(b.metrics);
  });

  it('baseline uses one box per item', () => {
    const items = expandProducts([prod({ quantity: 5 })]);
    const base = computeBaseline(items, [box()], true);
    expect(base.boxes).toBe(5);
  });

  it('respects maxItemsPerBox', () => {
    const res = optimize({
      products: [prod({ quantity: 10 })],
      boxes: [box({ length: 100, width: 100, height: 100 })],
      settings: { maxItemsPerBox: 4 },
    });
    for (const b of res.boxes) expect(b.placements.length).toBeLessThanOrEqual(4);
  });
});

describe('csv', () => {
  it('round-trips products', () => {
    const products = [prod({ sku: 'A-1', name: 'Widget, large', quantity: 7 })];
    const { products: back } = parseProductsCsv(productsToCsv(products));
    expect(back[0].sku).toBe('A-1');
    expect(back[0].name).toBe('Widget, large');
    expect(back[0].quantity).toBe(7);
  });

  it('parses boxes and tolerates unit suffixes', () => {
    const { boxes } = parseBoxesCsv('code,l,w,h,max weight,price\nA,30 cm,20 cm,15 cm,8 kg,1.20');
    expect(boxes[0]).toMatchObject({ code: 'A', length: 30, width: 20, height: 15, weightLimit: 8, cost: 1.2 });
  });

  it('reports invalid rows without throwing', () => {
    const { products, errors } = parseProductsCsv('sku,length,width,height\nBAD,,,');
    expect(products).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});