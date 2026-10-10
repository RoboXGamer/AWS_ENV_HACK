import type { BoxType, Product } from './types';

/**
 * Demo dataset: a small e-commerce order with a realistic mix of products and
 * a standard courier box catalogue. Used by the "Load demo" button so the app
 * has something impressive to show immediately.
 */

export const DEMO_PRODUCTS: Product[] = [
  { id: 'p1',  sku: 'SKU-1001', name: 'Wireless Earbuds',     length: 8,  width: 6,  height: 4,  weight: 0.15, quantity: 40 },
  { id: 'p2',  sku: 'SKU-1002', name: 'Bluetooth Speaker',    length: 18, width: 7,  height: 7,  weight: 0.5,  quantity: 25 },
  { id: 'p3',  sku: 'SKU-1003', name: 'USB-C Cable 1m',       length: 12, width: 8,  height: 3,  weight: 0.12, quantity: 60 },
  { id: 'p4',  sku: 'SKU-1004', name: 'Mechanical Keyboard',  length: 44, width: 14, height: 3.5,weight: 0.75, quantity: 15 },
  { id: 'p5',  sku: 'SKU-1005', name: 'Gaming Mouse',         length: 12, width: 7,  height: 4,  weight: 0.2,  quantity: 30 },
  { id: 'p6',  sku: 'SKU-1006', name: 'Laptop Stand',         length: 45, width: 25, height: 5,  weight: 1.2,  quantity: 10 },
  { id: 'p7',  sku: 'SKU-1007', name: 'Smartphone',           length: 16, width: 9,  height: 3,  weight: 0.45, quantity: 20 },
  { id: 'p8',  sku: 'SKU-1008', name: 'Cotton T-Shirt',       length: 30, width: 22, height: 6,  weight: 0.3,  quantity: 25 },
  { id: 'p9',  sku: 'SKU-1009', name: 'LED Desk Lamp',        length: 28, width: 18, height: 10, weight: 0.9,  quantity: 8 },
  { id: 'p10', sku: 'SKU-1010', name: 'Steel Water Bottle',   length: 27, width: 8,  height: 8,  weight: 0.45, quantity: 24 },
  { id: 'p11', sku: 'SKU-1011', name: 'Power Bank 20k',       length: 15, width: 8,  height: 2.5,weight: 0.35, quantity: 22 },
  { id: 'p12', sku: 'SKU-1012', name: 'HDMI Cable 2m',        length: 14, width: 10, height: 4,  weight: 0.18, quantity: 35 },
  { id: 'p13', sku: 'SKU-1013', name: 'Ceramic Mug',          length: 12, width: 9,  height: 10, weight: 0.4,  quantity: 18 },
  { id: 'p14', sku: 'SKU-1014', name: 'Yoga Mat (rolled)',    length: 65, width: 14, height: 14, weight: 1.1, quantity: 6 },
  { id: 'p15', sku: 'SKU-1015', name: 'Wall Clock',           length: 30, width: 30, height: 4,  weight: 0.8,  quantity: 9 },
  { id: 'p16', sku: 'SKU-1016', name: 'Dog Food 5kg',         length: 30, width: 20, height: 12, weight: 5.0, quantity: 12 },
];

/**
 * Costs are roughly proportional to cardboard surface area (~$1.65 / m2),
 * which is how corrugated is actually priced. Keeping this realistic matters:
 * an unrealistic catalogue where huge boxes are 3x cheaper per m2 makes any
 * cost-based optimizer look wrong for reasons that have nothing to do with the
 * packing algorithm.
 */
export const DEMO_BOXES: BoxType[] = [
  { id: 'b1', code: 'S-MAILER', length: 25, width: 18, height: 10, weightLimit: 5,  cost: 0.30 },
  { id: 'b2', code: 'S-CARTON', length: 30, width: 22, height: 15, weightLimit: 8,  cost: 0.48 },
  { id: 'b3', code: 'M-CARTON', length: 40, width: 30, height: 20, weightLimit: 15, cost: 0.85 },
  { id: 'b4', code: 'M-LONG',   length: 60, width: 40, height: 25, weightLimit: 25, cost: 1.60 },
  { id: 'b5', code: 'L-CARTON', length: 60, width: 40, height: 40, weightLimit: 30, cost: 2.10 },
  { id: 'b6', code: 'L-OVER',   length: 80, width: 60, height: 50, weightLimit: 40, cost: 3.80 },
];

/** Stable per-product palette for the 3D view. */
export const PRODUCT_COLORS = [
  '#4f8cff', '#22c55e', '#f59e0b', '#a855f7', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#eab308', '#8b5cf6', '#0ea5e9', '#d946ef',
  '#10b981', '#fb7185', '#a3e635', '#facc15', '#38bdf8',
];

export function colorForProduct(productId: string, products: Product[]): string {
  const idx = products.findIndex((p) => p.id === productId);
  return PRODUCT_COLORS[(idx < 0 ? 0 : idx) % PRODUCT_COLORS.length];
}