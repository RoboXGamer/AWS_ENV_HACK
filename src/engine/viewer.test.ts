import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { packBox } from './packer';
import type { BoxType, ItemInstance } from './types';

/**
 * The 3D viewer maps packing space onto three.js axes:
 *   packing x (length) -> three X
 *   packing z (height) -> three Y  (three is Y-up)
 *   packing y (width)  -> three Z
 *
 * A silent axis swap here would render a plausible-looking but wrong scene, so
 * we assert the exact geometry/position the viewer builds.
 */
function viewerBoxFor(p: {
  x: number; y: number; z: number; dx: number; dy: number; dz: number;
}): { size: THREE.Vector3; position: THREE.Vector3 } {
  // Mirrors BoxViewer3D exactly: new BoxGeometry(dx, dz, dy) at
  // (x + dx/2, z + dz/2, y + dy/2).
  const geo = new THREE.BoxGeometry(p.dx, p.dz, p.dy);
  const position = new THREE.Vector3(p.x + p.dx / 2, p.z + p.dz / 2, p.y + p.dy / 2);
  const size = new THREE.Vector3(geo.parameters.width, geo.parameters.height, geo.parameters.depth);
  geo.dispose();
  return { size, position };
}

const box: BoxType = {
  id: 'b', code: 'B', length: 30, width: 20, height: 10, weightLimit: 100, cost: 1,
};

const item = (over: Partial<ItemInstance> = {}): ItemInstance => ({
  uid: 'i0', productId: 'p', sku: 'S', name: 'N',
  length: 6, width: 4, height: 2, weight: 1, ...over,
});

describe('3D coordinate mapping', () => {
  it('maps length to X, width to Z, height to Y', () => {
    const p = { x: 0, y: 0, z: 0, dx: 6, dy: 4, dz: 2 };
    const { size, position } = viewerBoxFor(p);
    // three X = packing length (dx)
    expect(size.x).toBe(6);
    // three Y = packing height (dz)
    expect(size.y).toBe(2);
    // three Z = packing width (dy)
    expect(size.z).toBe(4);
    expect(position.x).toBe(3);
    expect(position.y).toBe(1);
    expect(position.z).toBe(2);
  });

  it('reproduces the exact viewer transform for a real placement', () => {
    const res = packBox(box, [item()], { allowRotation: true, maxWeight: 100 });
    const p = res.placements[0];
    const { size, position } = viewerBoxFor(p);

    // Geometry is the rotated extents, permuted into three's axis order.
    expect([size.x, size.y, size.z].sort((a, b) => a - b)).toEqual(
      [p.dx, p.dy, p.dz].sort((a, b) => a - b),
    );

    // Centre sits at half-extent inside the box on every axis: no gaps, no spill.
    expect(position.x).toBeCloseTo(p.x + p.dx / 2, 6);
    expect(position.y).toBeCloseTo(p.z + p.dz / 2, 6);
    expect(position.z).toBeCloseTo(p.y + p.dy / 2, 6);

    // Bounds check against the box shell, which is also permuted the same way.
    expect(position.x + size.x / 2).toBeLessThanOrEqual(box.length + 1e-6);
    expect(position.y + size.y / 2).toBeLessThanOrEqual(box.height + 1e-6);
    expect(position.z + size.z / 2).toBeLessThanOrEqual(box.width + 1e-6);
  });
});