/**
 * CSV import/export. Supports a wide range of column naming conventions so that
 * files exported from common warehouse tools work without manual editing.
 */

import type { BoxType, Product } from './types';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseRows(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Look up a value by any of several accepted column names.
 * Headers are matched exactly first, then by prefix so that columns like
 * `length_cm`, `Weight (kg)` or `box cost` resolve to the same field.
 */
function pick(row: Record<string, string>, names: string[]): string | undefined {
  for (const n of names) {
    const key = normaliseKey(n);
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  const keys = Object.keys(row);
  for (const n of names) {
    const key = normaliseKey(n);
    // Require at least 3 characters for prefix matching to avoid false hits.
    if (key.length < 3) continue;
    const match = keys.find((k) => k !== '' && (k.startsWith(key) || k.includes(key)));
    if (match && row[match] !== '') return row[match];
  }
  return undefined;
}

function num(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter.toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`;
}

/** Reset id counter so demo data is reproducible across reloads. */
export function resetIdCounter(n = 0): void {
  idCounter = n;
}

export function parseProductsCsv(text: string): { products: Product[]; errors: string[] } {
  const rows = parseRows(text);
  const products: Product[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const length = num(pick(row, ['length', 'len', 'l', 'depth', 'd']));
    const width = num(pick(row, ['width', 'w', 'breadth']));
    const height = num(pick(row, ['height', 'h', 'ht']));
    const quantity = num(pick(row, ['quantity', 'qty', 'count', 'units']), 1);
    if (length <= 0 || width <= 0 || height <= 0) {
      errors.push(`Row ${i + 2}: missing or invalid dimensions.`);
      return;
    }
    products.push({
      id: nextId('p'),
      sku: pick(row, ['sku', 'code', 'id', 'item', 'itemcode']) || `SKU-${i + 1}`,
      name: pick(row, ['name', 'description', 'product', 'item', 'title']) || `Product ${i + 1}`,
      length,
      width,
      height,
      weight: num(pick(row, ['weight', 'wt', 'kg', 'mass']), 0.5),
      quantity: Math.max(0, Math.round(quantity)),
    });
  });
  return { products, errors };
}

export function parseBoxesCsv(text: string): { boxes: BoxType[]; errors: string[] } {
  const rows = parseRows(text);
  const boxes: BoxType[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const length = num(pick(row, ['length', 'len', 'l', 'depth', 'd']));
    const width = num(pick(row, ['width', 'w', 'breadth']));
    const height = num(pick(row, ['height', 'h', 'ht']));
    if (length <= 0 || width <= 0 || height <= 0) {
      errors.push(`Row ${i + 2}: missing or invalid dimensions.`);
      return;
    }
    boxes.push({
      id: nextId('b'),
      code: pick(row, ['code', 'name', 'box', 'type', 'id']) || `BOX-${i + 1}`,
      length,
      width,
      height,
      weightLimit: num(pick(row, ['weightlimit', 'maxweight', 'weight', 'kg', 'limit']), 25),
      cost: num(pick(row, ['cost', 'price', 'unitcost']), 1),
    });
  });
  return { boxes, errors };
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function productsToCsv(products: Product[]): string {
  const header = 'sku,name,length_cm,width_cm,height_cm,weight_kg,quantity';
  const lines = products.map((p) =>
    [p.sku, p.name, p.length, p.width, p.height, p.weight, p.quantity].map(escapeCsv).join(','),
  );
  return [header, ...lines].join('\n');
}

export function boxesToCsv(boxes: BoxType[]): string {
  const header = 'code,length_cm,width_cm,height_cm,weight_limit_kg,cost';
  const lines = boxes.map((b) =>
    [b.code, b.length, b.width, b.height, b.weightLimit, b.cost].map(escapeCsv).join(','),
  );
  return [header, ...lines].join('\n');
}