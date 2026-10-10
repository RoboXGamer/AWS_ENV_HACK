/**
 * Geometry helpers: orientation generation, AABB overlap and contact scoring.
 * Pure, deterministic, no floating point fuzz beyond a fixed epsilon.
 */

import type { ItemInstance, Placement, Rotation } from './types';

export const EPS = 1e-6;

export interface Size3 {
  dx: number;
  dy: number;
  dz: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The 6 axis-aligned rotations of a box. De-duplicated so cubes yield 1 entry.
 */
export function orientations(l: number, w: number, h: number): Size3[] {
  const raw: [Rotation, Size3][] = [
    ['XY', { dx: l, dy: w, dz: h }],
    ['XZ', { dx: l, dy: h, dz: w }],
    ['YX', { dx: w, dy: l, dz: h }],
    ['YZ', { dx: w, dy: h, dz: l }],
    ['ZX', { dx: h, dy: l, dz: w }],
    ['ZY', { dx: h, dy: w, dz: l }],
  ];
  const seen = new Set<string>();
  const out: Size3[] = [];
  for (const [, s] of raw) {
    const key = `${s.dx}|${s.dy}|${s.dz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function rotations(l: number, w: number, h: number): { rotation: Rotation; size: Size3 }[] {
  const raw: [Rotation, Size3][] = [
    ['XY', { dx: l, dy: w, dz: h }],
    ['XZ', { dx: l, dy: h, dz: w }],
    ['YX', { dx: w, dy: l, dz: h }],
    ['YZ', { dx: w, dy: h, dz: l }],
    ['ZX', { dx: h, dy: l, dz: w }],
    ['ZY', { dx: h, dy: w, dz: l }],
  ];
  const seen = new Set<string>();
  const out: { rotation: Rotation; size: Size3 }[] = [];
  for (const [rotation, size] of raw) {
    const key = `${size.dx}|${size.dy}|${size.dz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rotation, size });
  }
  return out;
}

export function volume(s: Size3): number {
  return s.dx * s.dy * s.dz;
}

/** Total surface area of a rectangular prism (used for cardboard estimation). */
export function surfaceArea(s: Size3): number {
  return 2 * (s.dx * s.dy + s.dy * s.dz + s.dx * s.dz);
}

export function boxVolume(length: number, width: number, height: number): number {
  return length * width * height;
}

/** Length of the overlap of two 1D intervals. */
export function overlap1d(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** True when two axis-aligned boxes share more than zero volume. */
export function overlaps(
  ax: number, ay: number, az: number, adx: number, ady: number, adz: number,
  bx: number, by: number, bz: number, bdx: number, bdy: number, bdz: number,
): boolean {
  return (
    ax < bx + bdx - EPS &&
    bx < ax + adx - EPS &&
    ay < by + bdy - EPS &&
    by < ay + ady - EPS &&
    az < bz + bdz - EPS &&
    bz < az + adz - EPS
  );
}

/** True if `size` placed at `p` collides with any existing placement. */
export function collides(p: Point3, size: Size3, placed: Placement[]): boolean {
  for (const it of placed) {
    if (
      overlaps(
        p.x, p.y, p.z, size.dx, size.dy, size.dz,
        it.x, it.y, it.z, it.dx, it.dy, it.dz,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Contact area between a candidate placement and the items already in the box.
 * Maximising contact area is what keeps the packing dense and surface-conforming.
 */
export function contactArea(p: Point3, size: Size3, placed: Placement[]): number {
  let area = 0;
  for (const it of placed) {
    // Touching faces.
    if (
      Math.abs(p.x + size.dx - it.x) < EPS ||
      Math.abs(it.x + it.dx - p.x) < EPS
    ) {
      area +=
        overlap1d(p.y, p.y + size.dy, it.y, it.y + it.dy) *
        overlap1d(p.z, p.z + size.dz, it.z, it.z + it.dz);
    }
    if (
      Math.abs(p.y + size.dy - it.y) < EPS ||
      Math.abs(it.y + it.dy - p.y) < EPS
    ) {
      area +=
        overlap1d(p.x, p.x + size.dx, it.x, it.x + it.dx) *
        overlap1d(p.z, p.z + size.dz, it.z, it.z + it.dz);
    }
    if (
      Math.abs(p.z + size.dz - it.z) < EPS ||
      Math.abs(it.z + it.dz - p.z) < EPS
    ) {
      area +=
        overlap1d(p.x, p.x + size.dx, it.x, it.x + it.dx) *
        overlap1d(p.y, p.y + size.dy, it.y, it.y + it.dy);
    }
  }
  return area;
}

/** True when the item can sit at `p` with the given orientation inside the bin. */
export function fits(
  p: Point3,
  size: Size3,
  binLength: number,
  binWidth: number,
  binHeight: number,
): boolean {
  return (
    p.x >= -EPS &&
    p.y >= -EPS &&
    p.z >= -EPS &&
    p.x + size.dx <= binLength + EPS &&
    p.y + size.dy <= binWidth + EPS &&
    p.z + size.dz <= binHeight + EPS
  );
}

export function itemVolume(it: { length: number; width: number; height: number }): number {
  return boxVolume(it.length, it.width, it.height);
}

export type { ItemInstance };