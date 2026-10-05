'use client';

import { getDB, scopeFor } from './dexie';
import { computeStatus, quickDateFromNow } from './expiry';
import { uuid } from './utils';
import type { Category, Product, ProductBatch } from './database.types';

// Local demo data. Mirrors supabase/seed.sql but writes straight to Dexie so it
// works with no Supabase config. Deliberately NOT enqueued for sync: offline-scope
// rows can never be pushed (see sync.ts), and a demo should not pollute the queue.

const CATALOG: [name: string, category: Category][] = [
  ['حليب كامل الدسم ١ لتر', 'Dairy'],
  ['لبن يوناني ٥٠٠غ', 'Dairy'],
  ['جبنة شيدر ٢٠٠غ', 'Dairy'],
  ['زبدة ٢٥٠غ', 'Dairy'],
  ['جبنة كريمة ٢٠٠غ', 'Dairy'],
  ['جبنة موزاريلا ١٥٠غ', 'Dairy'],
  ['بيض (علبة ١٢ حبة)', 'Dairy'],
  ['خبز أبيض', 'Bakery'],
  ['خبز أسمر', 'Bakery'],
  ['باغيت', 'Bakery'],
  ['كرواسون (٤ قطع)', 'Bakery'],
  ['خبز بيتي', 'Bakery'],
  ['لحاف صاج', 'Bakery'],
  ['تونة معلبة ١٨٥غ', 'Canned Goods'],
  ['ذرة معلبة ٣٤٠غ', 'Canned Goods'],
  ['فاصوليا معلبة ٤٠٠غ', 'Canned Goods'],
  ['صلصة طماطم معلبة ٤٠٠غ', 'Canned Goods'],
  ['شوربة معلبة ٤٠٠غ', 'Canned Goods'],
  ['حليب جوز معلبة', 'Canned Goods'],
  ['عصير برتقال ١ لتر', 'Beverages'],
  ['عصير تفاح ١ لتر', 'Beverages'],
  ['مشروب غازي ٣٣٠مل', 'Beverages'],
  ['مياه غازية ١.٥ لتر', 'Beverages'],
  ['حليب لوز ١ لتر', 'Beverages'],
  ['حبوب قهوة ٢٥٠غ', 'Beverages'],
  ['بيتزا مجمدة', 'Frozen'],
  ['خضار مجمدة مشكل', 'Frozen'],
  ['مثلجات ٥٠٠مل', 'Frozen'],
  ['برجر دجاج مجمد', 'Frozen'],
  ['بطاطا مقلية مجمدة', 'Frozen'],
  ['توت مجمد مشكل', 'Frozen'],
  ['موز (حزمة)', 'Produce'],
  ['تفاح (٦ حبات)', 'Produce'],
  ['طماطم (٤ حبات)', 'Produce'],
  ['خس', 'Produce'],
  ['بصل ١ كغ', 'Produce'],
  ['بطاطا ٢ كغ', 'Produce'],
  ['جزر ١ كغ', 'Produce'],
  ['فلفل ألوان (٣ حبات)', 'Produce'],
  ['صدور دجاج ٥٠٠غ', 'Meat'],
  ['لحم مفروم ٥٠٠غ', 'Meat'],
  ['قطع غنم ٤٠٠غ', 'Meat'],
  ['فيليه سلمون ٣٠٠غ', 'Meat'],
  ['شرائح ديك رومي', 'Meat'],
  ['لحم بقري مقطّع ٢٠٠غ', 'Meat'],
  ['رقائق بطاطا ١٥٠غ', 'Snacks'],
  ['لوح شوكولاتة ١٠٠غ', 'Snacks'],
  ['أقراص جرانولا (٦ قطع)', 'Snacks'],
  ['بسكويت مملّح ٢٠٠غ', 'Snacks'],
  ['مكسرات مشكلة ٢٠٠غ', 'Snacks'],
  ['فشار ١٠٠غ', 'Snacks'],
  ['زيت زيتون ٥٠٠مل', 'General'],
  ['معكرونة ٥٠٠غ', 'General'],
  ['أرز ١ كغ', 'General'],
  ['فتات خبز ٢٠٠غ', 'General'],
  ['عسل ٣٥٠غ', 'General'],
  ['شراب القيقب ٢٥٠مل', 'General'],
];

// day offsets chosen to cover every status and both sides of the 7-day window
const BATCHES: [product: string, quantity: number, days: number][] = [
  ['حليب كامل الدسم ١ لتر', 2, -3],
  ['حليب كامل الدسم ١ لتر', 1, 2],
  ['خبز أبيض', 1, 0],
  ['خبز أبيض', 3, 5],
  ['باغيت', 1, -1],
  ['لبن يوناني ٥٠٠غ', 4, 6],
  ['لبن يوناني ٥٠٠غ', 2, 14],
  ['بيض (علبة ١٢ حبة)', 1, 21],
  ['بيض (علبة ١٢ حبة)', 2, 29],
  ['بيض (علبة ١٢ حبة)', 1, 365],
  ['جبنة شيدر ٢٠٠غ', 1, 9],
  ['زبدة ٢٥٠غ', 3, 18],
  ['جبنة كريمة ٢٠٠غ', 1, 25],
  ['صدور دجاج ٥٠٠غ', 2, -6],
  ['صدور دجاج ٥٠٠غ', 2, 4],
  ['فيليه سلمون ٣٠٠غ', 1, 8],
  ['لحم بقري مقطّع ٢٠٠غ', 1, 12],
  ['لحم مفروم ٥٠٠غ', 1, 3],
  ['خس', 2, -2],
  ['خس', 1, 4],
  ['موز (حزمة)', 3, 3],
  ['تفاح (٦ حبات)', 2, 16],
  ['طماطم (٤ حبات)', 1, 7],
  ['فلفل ألوان (٣ حبات)', 2, 11],
  ['تونة معلبة ١٨٥غ', 5, 540],
  ['ذرة معلبة ٣٤٠غ', 4, 420],
  ['فاصوليا معلبة ٤٠٠غ', 6, 300],
  ['شوربة معلبة ٤٠٠غ', 3, 180],
  ['بيتزا مجمدة', 2, 120],
  ['مثلجات ٥٠٠مل', 1, 45],
  ['برجر دجاج مجمد', 2, 150],
  ['عصير برتقال ١ لتر', 2, 10],
  ['مشروب غازي ٣٣٠مل', 12, 90],
  ['حبوب قهوة ٢٥٠غ', 1, 75],
  ['رقائق بطاطا ١٥٠غ', 3, 30],
  ['لوح شوكولاتة ١٠٠غ', 6, 60],
  ['أقراص جرانولا (٦ قطع)', 1, 22],
  ['زيت زيتون ٥٠٠مل', 1, 400],
  ['معكرونة ٥٠٠غ', 4, 200],
  ['أرز ١ كغ', 2, 365],
  ['عسل ٣٥٠غ', 1, 700],
];

export type SeedResult = { products: number; batches: number };

export async function seedDemoData(userId?: string | null): Promise<SeedResult> {
  const db = getDB();
  const owner = scopeFor(userId);

  const existing = await db.products.where('owner').equals(owner).toArray();
  const byName = new Map<string, string>();
  for (const p of existing) byName.set(p.name, p.id);

  const createdAt = new Date().toISOString();
  const newProducts: Product[] = [];

  for (const [name, category] of CATALOG) {
    if (byName.has(name)) continue;
    const product: Product = {
      id: uuid(),
      name,
      category,
      created_at: createdAt,
      // user_id stays null: demo data is local-only and is never pushed.
      user_id: null,
      owner,
    };
    byName.set(name, product.id);
    newProducts.push(product);
  }
  if (newProducts.length) await db.products.bulkAdd(newProducts);

  const batches: ProductBatch[] = [];
  const unmatched: string[] = [];
  for (const [name, quantity, days] of BATCHES) {
    const productId = byName.get(name);
    if (!productId) {
      unmatched.push(name);
      continue;
    }
    const expiry = quickDateFromNow(days);
    batches.push({
      id: uuid(),
      product_id: productId,
      quantity,
      expiry_date: expiry,
      status: computeStatus(expiry),
      is_notified: false,
      created_at: createdAt,
      user_id: null,
      owner,
    });
  }
  if (batches.length) await db.batches.bulkAdd(batches);

  // A typo in BATCHES would otherwise drop rows with no trace.
  if (unmatched.length) console.error('[Seed] BATCHES entries with no matching product:', unmatched);

  return { products: newProducts.length, batches: batches.length };
}

export async function clearLocalData(userId?: string | null): Promise<void> {
  const db = getDB();
  const owner = scopeFor(userId);
  await db.transaction('rw', db.products, db.batches, db.syncQueue, async () => {
    await db.products.where('owner').equals(owner).delete();
    await db.batches.where('owner').equals(owner).delete();
    await db.syncQueue.where('owner').equals(owner).delete();
  });
}
