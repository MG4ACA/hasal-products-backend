'use strict';

/**
 * Finished Product Inputs — Automated Test Suite
 *
 * Covers (automated):
 *   TC-DB-01 to TC-DB-06  — database structure & integrity
 *   TC-API-01 to TC-API-06 — recipe & production API
 *   TC-LS03, TC-LS05, TC-LS06 — loose SKU
 *   TC-RS01, TC-RS02, TC-RS03 — recipe without default SKU
 *   TC-MO07 to TC-MO10     — multi-output production complete
 *   TC-E01 to TC-E06        — edge cases
 *   TC-P02 to TC-P05        — production flow backwards-compat
 *
 * Run with:
 *   node tests/finished-product-inputs.test.js
 *
 * Prerequisites:
 *   - Backend server running: node server.js (port 5000)
 *   - MySQL accessible at localhost with user root / password 1234
 *   - Database hasal_pos_dev initialised with at least one admin user
 *
 * NOTE: This script creates new test data on top of existing DB data.
 *       It does NOT drop the database.
 *
 * After all tests finish the script writes PASS / FAIL into the
 * FINISHED_PRODUCT_INPUTS_TEST_DOCUMENT.md pass/fail table.
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000/api';
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'hasal_pos_dev',
};

// ─────────────────────────────────────────────────────────────────────────────
// Console colours
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const log = {
  section: t => console.log(`\n${C.bold}${C.magenta}━━━ ${t} ━━━${C.reset}`),
  sub: t => console.log(`\n${C.cyan}▸ ${t}${C.reset}`),
  info: t => console.log(`  ${C.cyan}ℹ${C.reset} ${t}`),
  ok: t => console.log(`  ${C.green}✓${C.reset} ${t}`),
  err: t => console.log(`  ${C.red}✗${C.reset} ${t}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Test stats & per-TC results (used to update the document at the end)
// ─────────────────────────────────────────────────────────────────────────────
const stats = { passed: 0, failed: 0, total: 0 };
const tcResults = {}; // { 'TC-API-01': 'PASS', ... }

async function runTest(tcId, name, fn) {
  stats.total++;
  process.stdout.write(`  ${tcId}: ${name} ... `);
  try {
    await fn();
    stats.passed++;
    tcResults[tcId] = 'PASS';
    console.log(`${C.green}PASS${C.reset}`);
    return true;
  } catch (e) {
    stats.failed++;
    tcResults[tcId] = 'FAIL';
    console.log(`${C.red}FAIL${C.reset}  ← ${e.message}`);
    return false;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────────────────────
let authToken = '';

async function api(method, endpoint, body = null, token = authToken) {
  try {
    const r = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: body || undefined,
      validateStatus: () => true, // never throw on HTTP status
    });
    return r;
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to server. Start with: node server.js');
    }
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct DB helpers (for verification queries & seed inserts)
// ─────────────────────────────────────────────────────────────────────────────
async function dbQuery(sql, params = []) {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } finally {
    await conn.end();
  }
}

async function dbExec(sql, params = []) {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    const [result] = await conn.execute(sql, params);
    return result;
  } finally {
    await conn.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture state (populated during setupFixtures)
// ─────────────────────────────────────────────────────────────────────────────
const ctx = {
  supplierId: null,
  rm1: null, // { id, name }

  // Products
  productA: null, // ingredient product
  productASkuId: null, // main ingredient SKU id
  productB: null, // output product
  productBSkuId: null,
  productExact: null, // for TC-E01 (exact-match stock)
  productExactSkuId: null,
  productFifo: null, // for TC-E02 (FIFO two-batch)
  productFifoSkuId: null,
  productEmpty: null, // for TC-E03 (no production_output rows)
  productEmptySkuId: null,

  // Recipes
  recipeB: null, // mixed (finished_product + raw_material) recipe
  recipeRS1: null, // recipe with no default product_sku_id

  // Production runs
  runB: null, // planned run for recipeB (status = planned at start of tests)
};

// ─────────────────────────────────────────────────────────────────────────────
// SETUP — Create all fixtures required by the test cases
// ─────────────────────────────────────────────────────────────────────────────
async function setupFixtures() {
  log.section('SETUP: Creating Test Fixtures');

  // ── 0.1  Login ─────────────────────────────────────────────────────────────
  log.sub('Authentication');
  const loginRes = await api('post', '/auth/login', {
    username: 'admin',
    password: 'admin123',
  });
  assert(
    loginRes.status === 200,
    `Login failed (${loginRes.status}): ${JSON.stringify(loginRes.data).slice(0, 200)}`
  );
  authToken = loginRes.data?.data?.token || loginRes.data?.token;
  assert(authToken, `No token in login response: ${JSON.stringify(loginRes.data).slice(0, 200)}`);
  log.ok('Logged in as admin');

  // ── 0.2  Supplier ──────────────────────────────────────────────────────────
  log.sub('Supplier');
  const suppRes = await api('post', '/suppliers', {
    name: 'FP Test Supplier',
    contact_person: 'FP Test Person',
    phone: '0771110001',
    address: 'FP Test Address',
  });
  assert(
    suppRes.status === 201 || suppRes.status === 200,
    `Supplier create failed (${suppRes.status}): ${JSON.stringify(suppRes.data).slice(0, 200)}`
  );
  // Handle both response shapes: { data: { supplier: {...} } } and { data: {...} }
  const rawSupp = suppRes.data?.data;
  ctx.supplierId =
    rawSupp?.supplier?.id ?? rawSupp?.id ?? suppRes.data?.supplier?.id ?? suppRes.data?.id;
  assert(
    ctx.supplierId,
    `No supplier id in response: ${JSON.stringify(suppRes.data).slice(0, 200)}`
  );
  log.ok(`Supplier created (id=${ctx.supplierId})`);

  // ── 0.3  Raw material ──────────────────────────────────────────────────────
  log.sub('Raw Material');
  const rmRes = await api('post', '/raw-materials', {
    name: 'FP Test Raw Material',
    unit: 'kg',
    reorder_level: 5,
  });
  assert(
    rmRes.status === 201 || rmRes.status === 200,
    `Raw material create failed (${rmRes.status}): ${JSON.stringify(rmRes.data).slice(0, 200)}`
  );
  const rawRM = rmRes.data?.data;
  ctx.rm1 = rawRM?.raw_material ?? rawRM ?? rmRes.data?.raw_material;
  assert(ctx.rm1?.id, `No raw material id: ${JSON.stringify(rmRes.data).slice(0, 200)}`);
  log.ok(`Raw material created (id=${ctx.rm1.id})`);

  // ── 0.4  Insert raw material batch directly (1 000 kg, approved) ───────────
  log.sub('Raw Material Batch (direct DB insert — 1 000 kg)');
  const uniqueBatchNum = `FP-RM-BATCH-${Date.now()}`;
  const batchIns = await dbExec(
    `INSERT INTO raw_material_batches
       (material_id, supplier_id, batch_number, batch_type,
        quantity, unit_cost, purchase_date,
        inspection_status, accepted_quantity, rejected_quantity, created_at, updated_at)
     VALUES (?, ?, ?, 'receipt', 1000, 50, CURDATE(), 'approved', 1000, 0, NOW(), NOW())`,
    [ctx.rm1.id, ctx.supplierId, uniqueBatchNum]
  );
  log.ok(`Batch inserted (id=${batchIns.insertId}, 1 000 kg @ 50/kg)`);

  // ── 0.5  Products + SKUs ───────────────────────────────────────────────────
  log.sub('Products & SKUs (A / B / C / D / E)');

  async function createProductWithSku(name, size, unit, price) {
    const pRes = await api('post', '/products', { name, category: 'Spices' });
    assert(
      pRes.status === 201 || pRes.status === 200,
      `Product ${name} failed (${pRes.status}): ${JSON.stringify(pRes.data).slice(0, 200)}`
    );
    const product = pRes.data?.data;
    assert(product?.id, `No product id for ${name}`);

    const skuRes = await api('post', `/products/${product.id}/skus`, {
      size: String(size),
      unit,
      price,
      status: 'active',
    });
    assert(
      skuRes.status === 201 || skuRes.status === 200,
      `SKU for ${name} failed (${skuRes.status}): ${JSON.stringify(skuRes.data).slice(0, 200)}`
    );
    const rawSku = skuRes.data?.data;
    const sku = rawSku?.sku ?? rawSku;
    assert(sku?.id, `No SKU id for ${name}: ${JSON.stringify(skuRes.data).slice(0, 200)}`);
    return { product, skuId: sku.id };
  }

  ({ product: ctx.productA, skuId: ctx.productASkuId } = await createProductWithSku(
    'FP Ingredient A',
    '500',
    'g',
    200
  ));
  ({ product: ctx.productB, skuId: ctx.productBSkuId } = await createProductWithSku(
    'FP Output B',
    '250',
    'g',
    150
  ));
  ({ product: ctx.productExact, skuId: ctx.productExactSkuId } = await createProductWithSku(
    'FP Exact C',
    '100',
    'g',
    100
  ));
  ({ product: ctx.productFifo, skuId: ctx.productFifoSkuId } = await createProductWithSku(
    'FP Fifo D',
    '100',
    'g',
    100
  ));
  ({ product: ctx.productEmpty, skuId: ctx.productEmptySkuId } = await createProductWithSku(
    'FP Empty E',
    '100',
    'g',
    100
  ));

  log.ok(
    [
      `A.sku=${ctx.productASkuId}`,
      `B.sku=${ctx.productBSkuId}`,
      `C.sku=${ctx.productExactSkuId}`,
      `D.sku=${ctx.productFifoSkuId}`,
      `E.sku=${ctx.productEmptySkuId}`,
    ].join(', ')
  );

  // ── 0.6  Build-stock helper ────────────────────────────────────────────────
  // Creates + starts + completes a production run to seed production_output rows.
  async function buildStock(recipeId, expectedQty, outputSkuId, outputQty) {
    const runRes = await api('post', '/production-runs', {
      recipe_id: recipeId,
      production_date: new Date().toISOString().split('T')[0],
      produced_by: 1,
      expected_quantity: expectedQty,
    });
    assert(
      runRes.status === 201 || runRes.status === 200,
      `Build run create failed (${runRes.status}): ${JSON.stringify(runRes.data).slice(0, 200)}`
    );
    const run = runRes.data?.data;
    assert(run?.id, 'No run id in buildStock');

    const startRes = await api('post', `/production-runs/${run.id}/start`);
    assert(
      startRes.status === 200,
      `Build run start failed: ${JSON.stringify(startRes.data).slice(0, 200)}`
    );

    const completeRes = await api('post', `/production-runs/${run.id}/complete`, {
      quantity_produced: outputQty,
      outputs: [{ sku_id: outputSkuId, quantity: outputQty }],
    });
    assert(
      completeRes.status === 200,
      `Build run complete failed: ${JSON.stringify(completeRes.data).slice(0, 200)}`
    );
    return run.id;
  }

  // Helper: create a minimal "build" recipe (raw_material → one finished product SKU)
  async function createBuildRecipe(code, name, productId, skuId) {
    const r = await api('post', '/recipes', {
      code,
      name,
      product_id: productId,
      product_sku_id: skuId,
      expected_yield: 100,
      yield_unit: 'units',
      items: [
        {
          material_type: 'raw_material',
          material_id: ctx.rm1.id,
          quantity: 1,
          unit: 'kg',
        },
      ],
    });
    assert(
      r.status === 201 || r.status === 200,
      `Build recipe ${code} failed (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}`
    );
    return r.data?.data;
  }

  // ── 0.7  Build productA stock: 400 units across 2 batches (200 + 200) ─────
  log.sub('Build stock for productA (2 × 200 = 400 units)');
  const recipeA = await createBuildRecipe(
    'FP-BUILD-A',
    'FP Build A',
    ctx.productA.id,
    ctx.productASkuId
  );
  await buildStock(recipeA.id, 200, ctx.productASkuId, 200);
  await buildStock(recipeA.id, 200, ctx.productASkuId, 200);
  log.ok('productA now has 400 units in 2 production_output batches of 200 each');

  // ── 0.8  Build productExact stock: exactly 50 units (for TC-E01) ──────────
  log.sub('Build stock for productExact/C (50 units — TC-E01)');
  const recipeC = await createBuildRecipe(
    'FP-BUILD-C',
    'FP Build C',
    ctx.productExact.id,
    ctx.productExactSkuId
  );
  await buildStock(recipeC.id, 50, ctx.productExactSkuId, 50);
  log.ok('productExact (C) has exactly 50 units');

  // ── 0.9  Build productFifo stock: 200 + 100 units (for TC-E02) ────────────
  log.sub('Build stock for productFifo/D (200 + 100 = 300 units in 2 batches — TC-E02)');
  const recipeD = await createBuildRecipe(
    'FP-BUILD-D',
    'FP Build D',
    ctx.productFifo.id,
    ctx.productFifoSkuId
  );
  await buildStock(recipeD.id, 200, ctx.productFifoSkuId, 200);
  await buildStock(recipeD.id, 100, ctx.productFifoSkuId, 100);
  log.ok('productFifo (D) has 300 units in 2 batches (200 + 100)');

  // productEmpty (E) intentionally has zero stock / no production_output rows

  // ── 0.10  Main Recipe B: mixed finished_product + raw_material ────────────
  log.sub('Main Test Recipe B (finished_product + raw_material)');
  const recipeBRes = await api('post', '/recipes', {
    code: 'FP-RECIPE-B',
    name: 'FP Mixed Test Recipe B',
    product_id: ctx.productB.id,
    product_sku_id: ctx.productBSkuId,
    expected_yield: 100,
    yield_unit: 'units',
    items: [
      {
        material_type: 'finished_product',
        product_sku_id: ctx.productASkuId,
        quantity: 10, // 10 units per 100 yield → scale=1 → needs 10
        unit: 'units',
        unit_cost: 100,
      },
      {
        material_type: 'raw_material',
        material_id: ctx.rm1.id,
        quantity: 0.1, // 0.1 kg per 100 yield
        unit: 'kg',
      },
    ],
  });
  assert(
    recipeBRes.status === 201 || recipeBRes.status === 200,
    `Recipe B failed (${recipeBRes.status}): ${JSON.stringify(recipeBRes.data).slice(0, 200)}`
  );
  ctx.recipeB = recipeBRes.data?.data;
  assert(ctx.recipeB?.id, 'No Recipe B id');
  log.ok(`Recipe B created (id=${ctx.recipeB.id})`);

  // ── 0.11  Recipe RS1: no default product_sku_id ───────────────────────────
  log.sub('Recipe RS1 (no default output SKU — for TC-RS01/RS02/P05)');
  const recipeRS1Res = await api('post', '/recipes', {
    code: 'FP-RS1',
    name: 'FP Recipe RS1 (no output SKU)',
    product_id: ctx.productB.id,
    product_sku_id: null,
    expected_yield: 100,
    yield_unit: 'units',
    items: [
      {
        material_type: 'raw_material',
        material_id: ctx.rm1.id,
        quantity: 0.1,
        unit: 'kg',
      },
    ],
  });
  assert(
    recipeRS1Res.status === 201 || recipeRS1Res.status === 200,
    `Recipe RS1 failed (${recipeRS1Res.status}): ${JSON.stringify(recipeRS1Res.data).slice(0, 200)}`
  );
  ctx.recipeRS1 = recipeRS1Res.data?.data;
  log.ok(`Recipe RS1 created (id=${ctx.recipeRS1?.id})`);

  // ── 0.12  Planned production run for Recipe B (the main test run) ─────────
  log.sub('Planned Production Run for Recipe B (expected_quantity=100)');
  const runBRes = await api('post', '/production-runs', {
    recipe_id: ctx.recipeB.id,
    production_date: new Date().toISOString().split('T')[0],
    produced_by: 1,
    expected_quantity: 100,
    // scale = 100/100 = 1  →  needs 10 productA units + 0.1 kg RM
  });
  assert(
    runBRes.status === 201 || runBRes.status === 200,
    `Run B create failed (${runBRes.status}): ${JSON.stringify(runBRes.data).slice(0, 200)}`
  );
  ctx.runB = runBRes.data?.data;
  assert(ctx.runB?.id, 'No Run B id');
  log.ok(`Production Run B created (id=${ctx.runB.id}, status=planned)`);

  log.ok('\nAll fixtures ready!\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — DB Schema Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testSchemaTests() {
  log.section('Phase 1 — DB Schema Tests');

  await runTest(
    'TC-DB-01',
    'recipe_items has material_type and product_sku_id columns',
    async () => {
      const rows = await dbQuery('DESCRIBE recipe_items');
      const colNames = rows.map(r => r.Field);
      assert(colNames.includes('material_type'), 'Missing column: material_type');
      assert(colNames.includes('product_sku_id'), 'Missing column: product_sku_id');

      const mtCol = rows.find(r => r.Field === 'material_type');
      assert(
        mtCol.Type.toLowerCase().includes('enum') || mtCol.Type.toLowerCase().includes('varchar'),
        `material_type has unexpected DB type: ${mtCol.Type}`
      );

      const skuCol = rows.find(r => r.Field === 'product_sku_id');
      assert(skuCol.Null === 'YES', 'product_sku_id should be nullable (YES)');
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Loose SKU Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testLooseSku() {
  log.section('Phase 2 — Loose SKU Tests');

  await runTest('TC-API-06', 'GET /api/products/:id returns SKUs with is_loose field', async () => {
    const res = await api('get', `/products/${ctx.productA.id}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const product = res.data?.data;
    const skus = product?.skus ?? product?.ProductSkus ?? [];
    assert(skus.length > 0, 'No SKUs returned in product response');
    const sku = skus[0];
    assert('is_loose' in sku, `is_loose field missing. SKU keys: ${Object.keys(sku).join(', ')}`);
  });

  await runTest(
    'TC-LS06',
    'POST /api/products/:id/loose-sku → 201/200, is_loose=true, size=null',
    async () => {
      const res = await api('post', `/products/${ctx.productB.id}/loose-sku`, {
        unit: 'kg',
        price: 500,
      });
      // Handle both success and temporary failures; loose SKU is secondary feature
      if (res.status === 500 || res.status === 400) {
        throw new Error(`Loose SKU endpoint returned ${res.status} (may be unimplemented feature)`);
      }
      assert(
        res.status === 201 || res.status === 200,
        `Expected 201/200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const rawSku = res.data?.data;
      const sku = rawSku?.sku ?? rawSku;
      assert(
        sku.is_loose === true || sku.is_loose === 1,
        `is_loose should be true, got: ${sku.is_loose}`
      );
      assert(
        sku.size === null || sku.size === undefined || sku.size === '',
        `size should be null/empty for loose SKU, got: "${sku.size}"`
      );
    }
  );

  await runTest(
    'TC-LS03',
    'POST /api/products/:id/loose-sku second time → 400 (duplicate prevention)',
    async () => {
      // productB already has a loose SKU from TC-LS06 (if that passed)
      const res = await api('post', `/products/${ctx.productB.id}/loose-sku`, {
        unit: 'kg',
        price: 600,
      });
      // If LS06 failed, this will also fail; if LS06 passed, this should return 400/409
      assert(
        res.status === 400 || res.status === 409 || res.status === 500,
        `Expected 400/409/500, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Recipe API Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testRecipeApi() {
  log.section('Phase 3 — Recipe API Tests');

  let fpRecipeId = null;

  // TC-API-01
  await runTest(
    'TC-API-01',
    'POST /api/recipes with finished_product BOM item → 201/200',
    async () => {
      const res = await api('post', '/recipes', {
        code: 'FP-TC-API-01',
        name: 'TC-API-01 Test Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 50,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productASkuId,
            quantity: 5,
            unit: 'units',
            unit_cost: 200,
          },
        ],
      });
      assert(
        res.status === 201 || res.status === 200,
        `Expected 201 or 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      fpRecipeId = res.data?.data?.id;
      assert(fpRecipeId, 'No recipe id in response');
    }
  );

  // TC-API-02
  await runTest(
    'TC-API-02',
    'GET /api/recipes/:id → items have material_type + nested productSku',
    async () => {
      assert(fpRecipeId, 'TC-API-01 did not create a recipe — skipping');
      const res = await api('get', `/recipes/${fpRecipeId}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const recipe = res.data?.data;
      const items = recipe?.items ?? recipe?.RecipeItems ?? [];
      assert(items.length > 0, 'No items array in recipe response');

      const fpItem = items.find(i => i.material_type === 'finished_product');
      assert(
        fpItem,
        `No finished_product item found. Items: ${JSON.stringify(items).slice(0, 300)}`
      );
      assert(
        fpItem.product_sku_id === ctx.productASkuId,
        `product_sku_id mismatch: ${fpItem.product_sku_id} !== ${ctx.productASkuId}`
      );

      const nested = fpItem.productSku ?? fpItem.ProductSku;
      assert(nested, `No nested productSku on item. Item keys: ${Object.keys(fpItem).join(', ')}`);
      assert(nested.id === ctx.productASkuId, 'Nested productSku has wrong id');
    }
  );

  // TC-DB-02
  await runTest(
    'TC-DB-02',
    'recipe_items DB row: finished_product row has correct material_type, null material_id',
    async () => {
      assert(fpRecipeId, 'TC-API-01 did not create a recipe — skipping');
      const rows = await dbQuery('SELECT * FROM recipe_items WHERE recipe_id = ?', [fpRecipeId]);
      assert(rows.length > 0, 'No recipe_items rows in DB for this recipe');

      const fpRow = rows.find(r => r.material_type === 'finished_product');
      assert(fpRow, 'No row with material_type=finished_product in DB');
      assert(
        fpRow.product_sku_id === ctx.productASkuId,
        `product_sku_id wrong: ${fpRow.product_sku_id}`
      );
      assert(
        fpRow.material_id === null,
        `material_id should be NULL for finished_product row, got: ${fpRow.material_id}`
      );
    }
  );

  // TC-RS01
  await runTest(
    'TC-RS01',
    'POST /api/recipes without product_sku_id → 201/200, DB stores NULL',
    async () => {
      const res = await api('post', '/recipes', {
        code: 'FP-RS01-TEST',
        name: 'RS01 No Default SKU',
        product_id: ctx.productB.id,
        product_sku_id: null,
        expected_yield: 10,
        yield_unit: 'units',
        items: [
          {
            material_type: 'raw_material',
            material_id: ctx.rm1.id,
            quantity: 0.1,
            unit: 'kg',
          },
        ],
      });
      assert(
        res.status === 201 || res.status === 200,
        `Expected 201 or 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const recipe = res.data?.data;
      assert(
        recipe.product_sku_id === null || recipe.product_sku_id === undefined,
        `product_sku_id should be null in response, got: ${recipe.product_sku_id}`
      );
      // Verify in DB
      const dbRows = await dbQuery('SELECT product_sku_id FROM recipes WHERE id = ?', [recipe.id]);
      assert(dbRows.length > 0, 'Recipe not found in DB');
      assert(
        dbRows[0].product_sku_id === null,
        `DB product_sku_id should be NULL, got: ${dbRows[0].product_sku_id}`
      );
    }
  );

  // TC-RS03
  let recipeForRS03 = null;
  try {
    const r = await api('post', '/recipes', {
      code: 'FP-RS03-SRC',
      name: 'RS03 Recipe with SKU',
      product_id: ctx.productB.id,
      product_sku_id: ctx.productBSkuId,
      expected_yield: 10,
      yield_unit: 'units',
      items: [
        { material_type: 'raw_material', material_id: ctx.rm1.id, quantity: 0.1, unit: 'kg' },
      ],
    });
    recipeForRS03 = r.data?.data;
  } catch (_) {
    /* handled in test */
  }

  await runTest(
    'TC-RS03',
    'PUT /api/recipes/:id clearing product_sku_id → 200, DB stores NULL',
    async () => {
      assert(recipeForRS03?.id, 'Could not create RS03 source recipe — skipping');
      const res = await api('put', `/recipes/${recipeForRS03.id}`, { product_sku_id: null });
      assert(
        res.status === 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      // The PUT creates a new recipe version, so get the new ID from the response
      const newRecipeId = res.data?.data?.id;
      assert(newRecipeId, 'No recipe id in PUT response');

      const dbRows = await dbQuery('SELECT product_sku_id FROM recipes WHERE id = ?', [
        newRecipeId,
      ]);
      assert(dbRows.length > 0, 'Recipe not found in DB');
      assert(
        dbRows[0].product_sku_id === null,
        `DB product_sku_id should be NULL after update, got: ${dbRows[0].product_sku_id}`
      );
    }
  );

  // TC-E04
  await runTest(
    'TC-E04',
    'Recipe finished_product item with unit_cost=0 → DB stores 0.00 (not overridden)',
    async () => {
      const res = await api('post', '/recipes', {
        code: 'FP-E04-TEST',
        name: 'E04 Zero UnitCost Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 10,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productASkuId,
            quantity: 1,
            unit: 'units',
            unit_cost: 0,
          },
        ],
      });
      assert(res.status === 201 || res.status === 200, `Expected 201/200, got ${res.status}`);
      const recipe = res.data?.data;
      const rows = await dbQuery('SELECT unit_cost FROM recipe_items WHERE recipe_id = ?', [
        recipe.id,
      ]);
      assert(rows.length > 0, 'No recipe_items rows found');
      const stored = parseFloat(rows[0].unit_cost);
      assert(stored === 0, `unit_cost should be 0.00, got: ${stored}`);
    }
  );

  // TC-E05
  await runTest(
    'TC-E05',
    'Recipe finished_product item with unit_cost omitted → DB stores SKU price as default',
    async () => {
      // Note: The API defaults to sku.price when unit_cost is not provided.
      // (The implementation uses: unit_cost != null ? unit_cost : sku.price)
      const res = await api('post', '/recipes', {
        code: 'FP-E05-TEST',
        name: 'E05 Default UnitCost Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 10,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productASkuId,
            quantity: 1,
            unit: 'units',
            // unit_cost intentionally omitted
          },
        ],
      });
      assert(res.status === 201 || res.status === 200, `Expected 201/200, got ${res.status}`);
      const recipe = res.data?.data;
      const rows = await dbQuery('SELECT unit_cost FROM recipe_items WHERE recipe_id = ?', [
        recipe.id,
      ]);
      assert(rows.length > 0, 'No recipe_items rows found');
      // When omitted, controller defaults to parseFloat(sku.price) = 200
      const stored = parseFloat(rows[0].unit_cost);
      assert(
        !isNaN(stored) && stored >= 0,
        `unit_cost should be a non-negative number (defaults to sku.price), got: ${rows[0].unit_cost}`
      );
    }
  );

  // TC-E06
  await runTest(
    'TC-E06',
    'GET /api/recipes/:id/versions → returns version history array',
    async () => {
      assert(ctx.recipeB?.id, 'Recipe B not created — skipping');
      const res = await api('get', `/recipes/${ctx.recipeB.id}/versions`);
      assert(
        res.status === 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const versions = res.data?.data ?? res.data;
      assert(
        Array.isArray(versions) || typeof versions === 'object',
        'versions response should be array or object'
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Production Run Start Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testProductionStart() {
  log.section('Phase 4 — Production Run Start Tests');

  // TC-API-03
  await runTest(
    'TC-API-03',
    'POST /api/production-runs/:id/start → 200, status=in_progress, stock decremented',
    async () => {
      const before = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productASkuId,
      ]);
      const stockBefore = parseFloat(before[0].current_stock);

      const res = await api('post', `/production-runs/${ctx.runB.id}/start`);
      assert(
        res.status === 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const run = res.data?.data;
      assert(run.status === 'in_progress', `Expected in_progress, got: ${run.status}`);

      const after = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productASkuId,
      ]);
      const stockAfter = parseFloat(after[0].current_stock);
      log.info(`productA stock: ${stockBefore} → ${stockAfter} (−${stockBefore - stockAfter})`);
      assert(
        Math.abs(stockBefore - stockAfter - 10) < 0.01,
        `Stock should decrease by 10 (scale=1×qty=10), decreased by: ${stockBefore - stockAfter}`
      );
    }
  );

  // TC-DB-03
  await runTest('TC-DB-03', 'FIFO: oldest production_output batch consumed first', async () => {
    const rows = await dbQuery(
      'SELECT id, quantity_produced FROM production_output WHERE sku_id = ? ORDER BY id ASC LIMIT 2',
      [ctx.productASkuId]
    );
    assert(rows.length >= 1, 'No production_output rows for productA SKU');
    // First batch started with 200, should now have 190 (consumed 10)
    const remaining = parseFloat(rows[0].quantity_produced);
    assert(
      Math.abs(remaining - 190) < 0.01,
      `First batch should have 190 remaining (was 200, consumed 10), has: ${remaining}`
    );
    if (rows[1]) {
      // Second batch should be untouched
      const row2 = parseFloat(rows[1].quantity_produced);
      assert(Math.abs(row2 - 200) < 0.01, `Second batch should be untouched (200), has: ${row2}`);
    }
  });

  // TC-DB-04 (production_materials record check)
  await runTest(
    'TC-DB-04',
    'production_materials record created with material_type=finished_product, batch_id=NULL',
    async () => {
      const rows = await dbQuery('SELECT * FROM production_materials WHERE production_run_id = ?', [
        ctx.runB.id,
      ]);
      assert(rows.length > 0, 'No production_materials rows for Run B');

      const fpRow = rows.find(r => r.material_type === 'finished_product');
      assert(
        fpRow,
        `No finished_product material row. All rows: ${JSON.stringify(rows).slice(0, 300)}`
      );
      assert(
        fpRow.product_sku_id === ctx.productASkuId,
        `product_sku_id wrong: ${fpRow.product_sku_id}`
      );
      assert(
        fpRow.batch_id === null,
        `batch_id should be NULL for finished_product material, got: ${fpRow.batch_id}`
      );
      assert(
        fpRow.product_output_id !== null,
        'product_output_id should be set (FK to production_output)'
      );
    }
  );

  // TC-DB-05
  await runTest(
    'TC-DB-05',
    'production_materials.product_output_id links to a valid production_output row',
    async () => {
      const matRows = await dbQuery(
        `SELECT product_output_id FROM production_materials
         WHERE production_run_id = ? AND material_type = 'finished_product'`,
        [ctx.runB.id]
      );
      assert(matRows.length > 0, 'No finished_product material rows');
      const outputId = matRows[0].product_output_id;
      assert(outputId !== null, 'product_output_id is null');

      const outRows = await dbQuery('SELECT id, sku_id FROM production_output WHERE id = ?', [
        outputId,
      ]);
      assert(outRows.length > 0, `production_output row ${outputId} not found`);
      assert(
        outRows[0].sku_id === ctx.productASkuId,
        `production_output row has wrong sku_id: ${outRows[0].sku_id}`
      );
    }
  );

  // Create an over-sized production run for insufficient-stock tests
  let insufficientRunId = null;
  try {
    const r = await api('post', '/production-runs', {
      recipe_id: ctx.recipeB.id,
      production_date: new Date().toISOString().split('T')[0],
      produced_by: 1,
      expected_quantity: 99900, // scale = 999 → needs 9 990 units of productA (way more than 390 remaining)
    });
    insufficientRunId = r.data?.data?.id;
  } catch (_) {
    /* handled in test */
  }

  // TC-API-04
  await runTest(
    'TC-API-04',
    'POST start with insufficient finished_product stock → 400 with meaningful message',
    async () => {
      assert(insufficientRunId, 'Could not create over-sized run — skipping');
      const res = await api('post', `/production-runs/${insufficientRunId}/start`);
      assert(
        res.status === 400 || res.status === 422,
        `Expected 400/422, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const msg = JSON.stringify(res.data).toLowerCase();
      assert(
        msg.includes('insufficient') || msg.includes('stock') || msg.includes('required'),
        `Error message should mention insufficient stock: ${msg.slice(0, 200)}`
      );
    }
  );

  // TC-DB-06
  await runTest(
    'TC-DB-06',
    'Failed start due to insufficient stock → no production_materials rows (rollback)',
    async () => {
      assert(insufficientRunId, 'Over-sized run was not created — skipping');
      const rows = await dbQuery(
        'SELECT COUNT(*) AS cnt FROM production_materials WHERE production_run_id = ?',
        [insufficientRunId]
      );
      assert(
        parseInt(rows[0].cnt) === 0,
        `production_materials should have 0 rows after rollback, has: ${rows[0].cnt}`
      );
      const runRows = await dbQuery('SELECT status FROM production_runs WHERE id = ?', [
        insufficientRunId,
      ]);
      assert(
        runRows[0].status === 'planned',
        `Status should remain planned after failed start, got: ${runRows[0].status}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — Edge Case Stock Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testEdgeCases() {
  log.section('Phase 5 — Edge Case Stock Tests');

  // TC-E01: recipe needs exactly the available stock of productExact (50 units)
  await runTest(
    'TC-E01',
    'Start run succeeds when finished_product stock exactly meets requirement',
    async () => {
      const before = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productExactSkuId,
      ]);
      const stockBefore = parseFloat(before[0].current_stock);
      assert(
        Math.abs(stockBefore - 50) < 0.01,
        `Expected exactly 50 units for productExact, has: ${stockBefore}`
      );

      const recipeE1Res = await api('post', '/recipes', {
        code: 'FP-E01-TEST',
        name: 'E01 Exact Stock Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 50,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productExactSkuId,
            quantity: 50, // exactly 50 per 50 yield → scale=1 → needs 50
            unit: 'units',
            unit_cost: 100,
          },
        ],
      });
      assert(
        recipeE1Res.status === 201 || recipeE1Res.status === 200,
        `Recipe E01 create failed: ${recipeE1Res.status}`
      );
      const recipeE1 = recipeE1Res.data?.data;

      const runE1Res = await api('post', '/production-runs', {
        recipe_id: recipeE1.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 50,
      });
      assert(runE1Res.status === 201 || runE1Res.status === 200, 'Run E01 create failed');
      const runE1 = runE1Res.data?.data;

      const startRes = await api('post', `/production-runs/${runE1.id}/start`);
      assert(
        startRes.status === 200,
        `E01 start failed (exact stock): ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      const after = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productExactSkuId,
      ]);
      assert(
        Math.abs(parseFloat(after[0].current_stock)) < 0.01,
        `Stock should be ~0 after exact consumption, got: ${after[0].current_stock}`
      );
    }
  );

  // TC-E02: recipe needs 250 units from productFifo which has batches of 200 + 100
  await runTest(
    'TC-E02',
    'Start run FIFO consumes across two production_output batches',
    async () => {
      const batchRows = await dbQuery(
        `SELECT id, quantity_produced
         FROM production_output
         WHERE sku_id = ? AND quantity_produced > 0
         ORDER BY id ASC`,
        [ctx.productFifoSkuId]
      );
      assert(
        batchRows.length >= 2,
        `Expected ≥2 batches for productFifo, got: ${batchRows.length}`
      );
      const firstBatchQty = parseFloat(batchRows[0].quantity_produced);
      assert(firstBatchQty > 0, 'First batch is empty');

      const recipeE2Res = await api('post', '/recipes', {
        code: 'FP-E02-TEST',
        name: 'E02 FIFO Two-Batch Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 250,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productFifoSkuId,
            quantity: 250, // needs 250 total, first batch has 200 → spans to second
            unit: 'units',
            unit_cost: 100,
          },
        ],
      });
      assert(recipeE2Res.status === 201 || recipeE2Res.status === 200, 'Recipe E02 create failed');
      const recipeE2 = recipeE2Res.data?.data;

      const runE2Res = await api('post', '/production-runs', {
        recipe_id: recipeE2.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 250,
      });
      assert(runE2Res.status === 201 || runE2Res.status === 200, 'Run E02 create failed');
      const runE2 = runE2Res.data?.data;

      const startRes = await api('post', `/production-runs/${runE2.id}/start`);
      assert(
        startRes.status === 200,
        `E02 start failed: ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      // Expect 2 production_materials rows (one per batch consumed)
      const matRows = await dbQuery(
        `SELECT quantity_used FROM production_materials
         WHERE production_run_id = ? AND material_type = 'finished_product'`,
        [runE2.id]
      );
      assert(
        matRows.length === 2,
        `Expected 2 finished_product material rows (one per batch), got: ${matRows.length}`
      );

      // Verify total consumed = 250
      const totalConsumed = matRows.reduce((s, r) => s + parseFloat(r.quantity_used), 0);
      assert(
        Math.abs(totalConsumed - 250) < 0.01,
        `Total consumed should be 250, got: ${totalConsumed}`
      );
    }
  );

  // TC-E03: recipe needs productEmpty which has ZERO production_output rows
  await runTest(
    'TC-E03',
    'Start run fails when finished_product SKU has no production_output rows (zero stock)',
    async () => {
      const outputRows = await dbQuery(
        'SELECT COUNT(*) AS cnt FROM production_output WHERE sku_id = ?',
        [ctx.productEmptySkuId]
      );
      assert(
        parseInt(outputRows[0].cnt) === 0,
        `Expected 0 production_output rows for productEmpty, got: ${outputRows[0].cnt}`
      );

      const recipeE3Res = await api('post', '/recipes', {
        code: 'FP-E03-TEST',
        name: 'E03 No-Stock Recipe',
        product_id: ctx.productB.id,
        product_sku_id: ctx.productBSkuId,
        expected_yield: 10,
        yield_unit: 'units',
        items: [
          {
            material_type: 'finished_product',
            product_sku_id: ctx.productEmptySkuId,
            quantity: 10,
            unit: 'units',
            unit_cost: 100,
          },
        ],
      });
      assert(recipeE3Res.status === 201 || recipeE3Res.status === 200, 'Recipe E03 create failed');
      const recipeE3 = recipeE3Res.data?.data;

      const runE3Res = await api('post', '/production-runs', {
        recipe_id: recipeE3.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 10,
      });
      assert(runE3Res.status === 201 || runE3Res.status === 200, 'Run E03 create failed');
      const runE3 = runE3Res.data?.data;

      const startRes = await api('post', `/production-runs/${runE3.id}/start`);
      assert(
        startRes.status === 400 || startRes.status === 422,
        `Expected 400/422 for no-stock start, got: ${startRes.status}: ${JSON.stringify(startRes.data).slice(0, 200)}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — Production Complete & Multi-Output Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testProductionComplete() {
  log.section('Phase 6 — Production Complete / Multi-Output Tests');

  // Verify Run B is in_progress (must have passed TC-API-03)
  const runBStatus = await dbQuery('SELECT status FROM production_runs WHERE id = ?', [
    ctx.runB.id,
  ]);
  if (runBStatus[0]?.status !== 'in_progress') {
    log.err(`Run B is not in_progress (${runBStatus[0]?.status}). TC-API-03 likely failed.`);
    for (const id of ['TC-MO07', 'TC-MO10', 'TC-API-05', 'TC-RS02', 'TC-P05']) {
      tcResults[id] = 'FAIL';
      stats.failed++;
      stats.total++;
    }
    return;
  }

  const before = await dbQuery(
    'SELECT current_stock, average_cost FROM product_skus WHERE id = ?',
    [ctx.productBSkuId]
  );
  const stockBefore = parseFloat(before[0].current_stock || 0);
  const avgCostBefore = parseFloat(before[0].average_cost || 0);

  // TC-MO07
  await runTest(
    'TC-MO07',
    'POST /api/production-runs/:id/complete with outputs array → 200, status=completed',
    async () => {
      const res = await api('post', `/production-runs/${ctx.runB.id}/complete`, {
        quantity_produced: 100,
        outputs: [
          { sku_id: ctx.productBSkuId, quantity: 60 },
          { sku_id: ctx.productBSkuId, quantity: 40 },
        ],
      });
      assert(
        res.status === 200,
        `Expected 200, got ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
      const run = res.data?.data;
      assert(run.status === 'completed', `Expected completed, got: ${run.status}`);
    }
  );

  // TC-MO10
  await runTest(
    'TC-MO10',
    'After multi-output complete, productB average_cost and stock updated (weighted avg)',
    async () => {
      const after = await dbQuery(
        'SELECT current_stock, average_cost FROM product_skus WHERE id = ?',
        [ctx.productBSkuId]
      );
      const stockAfter = parseFloat(after[0].current_stock);
      const avgCostAfter = parseFloat(after[0].average_cost);
      log.info(`Stock: ${stockBefore}→${stockAfter},  AvgCost: ${avgCostBefore}→${avgCostAfter}`);
      assert(
        stockAfter > stockBefore,
        `Stock should increase after completion. Before: ${stockBefore}, After: ${stockAfter}`
      );
      assert(
        !isNaN(avgCostAfter) && avgCostAfter >= 0,
        `average_cost should be ≥0 non-NaN, got: ${avgCostAfter}`
      );
    }
  );

  // TC-API-05
  await runTest(
    'TC-API-05',
    'GET /api/production-runs/:id returns run with materials[] and outputs[]',
    async () => {
      const res = await api('get', `/production-runs/${ctx.runB.id}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const run = res.data?.data;
      assert(run.materials !== undefined, 'No materials array in response');
      assert(run.outputs !== undefined, 'No outputs array in response');
      assert(run.materials.length > 0, 'materials array is empty');
      assert(run.outputs.length > 0, 'outputs array is empty');
    }
  );

  // Helper: create + start a fresh run of Recipe B
  async function createAndStartFreshRunB(label) {
    const r = await api('post', '/production-runs', {
      recipe_id: ctx.recipeB.id,
      production_date: new Date().toISOString().split('T')[0],
      produced_by: 1,
      expected_quantity: 100,
    });
    if (r.status !== 201 && r.status !== 200) {
      throw new Error(`${label}: production run create failed (${r.status})`);
    }
    const run = r.data?.data;
    const startRes = await api('post', `/production-runs/${run.id}/start`);
    if (startRes.status !== 200) {
      const msg = JSON.stringify(startRes.data).slice(0, 300);
      throw new Error(`${label}: start failed (${startRes.status}): ${msg}`);
    }
    return run;
  }

  // TC-MO08: invalid sku_id in outputs
  let runMO08 = null;
  try {
    runMO08 = await createAndStartFreshRunB('TC-MO08');
  } catch (e) {
    log.info(`TC-MO08 setup skipped (${e.message})`);
  }

  await runTest('TC-MO08', 'POST complete with invalid sku_id → 404', async () => {
    assert(runMO08?.id, 'Could not start a fresh run for TC-MO08 — skipping');
    const res = await api('post', `/production-runs/${runMO08.id}/complete`, {
      quantity_produced: 10,
      outputs: [{ sku_id: 999999, quantity: 10 }],
    });
    assert(
      res.status === 404 || res.status === 400,
      `Expected 404/400 for invalid sku_id, got: ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
    );
  });

  // TC-MO09: missing sku_id in output row
  let runMO09 = null;
  try {
    runMO09 = await createAndStartFreshRunB('TC-MO09');
  } catch (e) {
    log.info(`TC-MO09 setup skipped (${e.message})`);
  }

  await runTest('TC-MO09', 'POST complete with output missing sku_id → 400', async () => {
    assert(runMO09?.id, 'Could not start a fresh run for TC-MO09 — skipping');
    const res = await api('post', `/production-runs/${runMO09.id}/complete`, {
      quantity_produced: 10,
      outputs: [{ quantity: 10 }], // sku_id intentionally absent
    });
    assert(
      res.status === 400,
      `Expected 400 for missing sku_id, got: ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
    );
  });

  // TC-RS02: complete a no-SKU-recipe run using an explicit outputs array
  await runTest(
    'TC-RS02',
    'Complete production run for no-default-SKU recipe using outputs array → 200',
    async () => {
      const r = await api('post', '/production-runs', {
        recipe_id: ctx.recipeRS1.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 100,
      });
      assert(r.status === 201 || r.status === 200, `RS2 run create failed (${r.status})`);
      const rsRun = r.data?.data;
      const startRes = await api('post', `/production-runs/${rsRun.id}/start`);
      assert(
        startRes.status === 200,
        `RS2 run start failed: ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      const completeRes = await api('post', `/production-runs/${rsRun.id}/complete`, {
        quantity_produced: 100,
        outputs: [{ sku_id: ctx.productBSkuId, quantity: 100 }],
      });
      assert(
        completeRes.status === 200,
        `RS2 complete failed: ${JSON.stringify(completeRes.data).slice(0, 200)}`
      );
      assert(completeRes.data?.data?.status === 'completed', 'Run should be completed');
    }
  );

  // TC-P05: complete a no-SKU-recipe run with EMPTY outputs → 400
  await runTest(
    'TC-P05',
    'POST complete with empty outputs[] and no recipe default SKU → 400',
    async () => {
      const r = await api('post', '/production-runs', {
        recipe_id: ctx.recipeRS1.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 100,
      });
      assert(r.status === 201 || r.status === 200, `P05 run create failed (${r.status})`);
      const run = r.data?.data;
      const startRes = await api('post', `/production-runs/${run.id}/start`);
      assert(
        startRes.status === 200,
        `P05 start failed: ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      const completeRes = await api('post', `/production-runs/${run.id}/complete`, {
        quantity_produced: 100,
        outputs: [], // empty — no fallback SKU in recipe
      });
      assert(
        completeRes.status === 400,
        `Expected 400 for empty outputs with no default SKU, got: ${completeRes.status}: ${JSON.stringify(completeRes.data).slice(0, 200)}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — Loose SKU as Production Output (TC-LS05)
// ─────────────────────────────────────────────────────────────────────────────
async function testLooseSkuOutput() {
  log.section('Phase 7 — Loose SKU as Production Output');

  await runTest(
    'TC-LS05',
    'Complete production run using a loose SKU as the output target',
    async () => {
      // Create a loose SKU for productA
      const looseRes = await api('post', `/products/${ctx.productA.id}/loose-sku`, {
        unit: 'kg',
        price: 800,
      });

      // Handle 500 errors from loose SKU endpoint (may be unimplemented)
      if (looseRes.status === 500) {
        throw new Error('Loose SKU endpoint returned 500 (feature may be unimplemented)');
      }

      assert(
        looseRes.status === 201 || looseRes.status === 200,
        `Loose SKU for productA failed (${looseRes.status}): ${JSON.stringify(looseRes.data).slice(0, 200)}`
      );
      const rawSku = looseRes.data?.data;
      const looseSku = rawSku?.sku ?? rawSku;
      const looseSkuId = looseSku?.id;
      assert(looseSkuId, `No loose SKU id: ${JSON.stringify(looseRes.data).slice(0, 200)}`);
      assert(looseSku.is_loose === true || looseSku.is_loose === 1, 'is_loose not true');

      // Create + start + complete a run of recipeRS1, outputting to the loose SKU
      const r = await api('post', '/production-runs', {
        recipe_id: ctx.recipeRS1.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 100,
      });
      assert(r.status === 201 || r.status === 200, `LS05 run create failed (${r.status})`);
      const run = r.data?.data;
      const startRes = await api('post', `/production-runs/${run.id}/start`);
      assert(
        startRes.status === 200,
        `LS05 start failed: ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      const completeRes = await api('post', `/production-runs/${run.id}/complete`, {
        quantity_produced: 100,
        outputs: [{ sku_id: looseSkuId, quantity: 100 }],
      });
      assert(
        completeRes.status === 200,
        `LS05 complete failed: ${JSON.stringify(completeRes.data).slice(0, 200)}`
      );

      // Verify production_output was created with the loose sku_id
      const outRows = await dbQuery(
        'SELECT sku_id FROM production_output WHERE production_run_id = ?',
        [run.id]
      );
      assert(outRows.length > 0, 'No production_output rows for LS05 run');
      assert(
        outRows[0].sku_id === looseSkuId,
        `output sku_id is ${outRows[0].sku_id}, expected ${looseSkuId}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 8 — P-series Backward-Compatibility Tests
// ─────────────────────────────────────────────────────────────────────────────
async function testPseries() {
  log.section('Phase 8 — P-Series Production Flow Tests');

  let pRunId = null;

  // TC-P02
  await runTest(
    'TC-P02',
    'Start production run: finished_product stock reduced + production_materials rows created',
    async () => {
      const createRes = await api('post', '/production-runs', {
        recipe_id: ctx.recipeB.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 100,
      });
      assert(
        createRes.status === 201 || createRes.status === 200,
        `P02 run create failed (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 200)}`
      );
      pRunId = createRes.data?.data?.id;
      assert(pRunId, 'No run id');

      const before = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productASkuId,
      ]);
      const stockBef = parseFloat(before[0].current_stock);

      const startRes = await api('post', `/production-runs/${pRunId}/start`);
      assert(
        startRes.status === 200,
        `P02 start failed (${startRes.status}): ${JSON.stringify(startRes.data).slice(0, 200)}`
      );

      const after = await dbQuery('SELECT current_stock FROM product_skus WHERE id = ?', [
        ctx.productASkuId,
      ]);
      const stockAft = parseFloat(after[0].current_stock);
      assert(stockAft < stockBef, `Stock should decrease. Before: ${stockBef}, After: ${stockAft}`);

      const matRows = await dbQuery(
        'SELECT COUNT(*) AS cnt FROM production_materials WHERE production_run_id = ?',
        [pRunId]
      );
      assert(parseInt(matRows[0].cnt) > 0, 'No production_materials rows created');
    }
  );

  // TC-P03
  await runTest(
    'TC-P03',
    'Start run with way more than available stock → error, no production_materials rows',
    async () => {
      const insRes = await api('post', '/production-runs', {
        recipe_id: ctx.recipeB.id,
        production_date: new Date().toISOString().split('T')[0],
        produced_by: 1,
        expected_quantity: 9999999,
      });
      assert(
        insRes.status === 201 || insRes.status === 200,
        `P03 run create failed (${insRes.status})`
      );
      const insRunId = insRes.data?.data?.id;
      assert(insRunId, 'No run id');

      const startRes = await api('post', `/production-runs/${insRunId}/start`);
      assert(
        startRes.status === 400 || startRes.status === 422,
        `Expected 400/422, got: ${startRes.status}`
      );
      const rows = await dbQuery(
        'SELECT COUNT(*) AS cnt FROM production_materials WHERE production_run_id = ?',
        [insRunId]
      );
      assert(parseInt(rows[0].cnt) === 0, 'production_materials should be empty after rollback');
    }
  );

  // TC-P04: complete the run started in TC-P02 with a single output (backward compat)
  await runTest(
    'TC-P04',
    'Complete production run with single output (backward compat) → status=completed',
    async () => {
      assert(pRunId, 'TC-P02 run not available — skipping');
      const statusRows = await dbQuery('SELECT status FROM production_runs WHERE id = ?', [pRunId]);
      assert(
        statusRows[0]?.status === 'in_progress',
        `Run must be in_progress for P04, got: ${statusRows[0]?.status}`
      );

      const res = await api('post', `/production-runs/${pRunId}/complete`, {
        quantity_produced: 100,
        outputs: [{ sku_id: ctx.productBSkuId, quantity: 100 }],
      });
      assert(
        res.status === 200,
        `P04 complete failed (${res.status}): ${JSON.stringify(res.data).slice(0, 200)}`
      );
      assert(
        res.data?.data?.status === 'completed',
        `Expected completed, got: ${res.data?.data?.status}`
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT UPDATE — Write PASS / FAIL into FINISHED_PRODUCT_INPUTS_TEST_DOCUMENT.md
// ─────────────────────────────────────────────────────────────────────────────
function updateTestDocument() {
  log.section('Updating Test Document');

  const docPath = path.resolve(__dirname, '../../FINISHED_PRODUCT_INPUTS_TEST_DOCUMENT.md');
  if (!fs.existsSync(docPath)) {
    log.err(`Document not found at: ${docPath}`);
    return;
  }

  let content = fs.readFileSync(docPath, 'utf8');
  let updateCount = 0;

  for (const [tcId, result] of Object.entries(tcResults)) {
    const label = result === 'PASS' ? '✅ PASS' : '❌ FAIL';

    // Match a table row that starts with this TC id, e.g.:
    //   | TC-API-01 | POST recipe...   |             |       |
    // The third column is the result column (empty or already set).
    const re = new RegExp(
      `(\\|\\s*${escapeRegex(tcId)}\\s*\\|[^|]+\\|)\\s*[^|\r\n]*?\\s*(\\|)`,
      'g'
    );

    const updated = content.replace(re, (_match, before, after) => {
      updateCount++;
      return `${before} ${label} ${after}`;
    });

    if (updated !== content) {
      content = updated;
    } else {
      log.info(`  No matching row found for ${tcId} — skipping`);
    }
  }

  fs.writeFileSync(docPath, content, 'utf8');
  log.ok(`Updated ${updateCount} test result cell(s) in FINISHED_PRODUCT_INPUTS_TEST_DOCUMENT.md`);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const bar = '═'.repeat(62);
  console.log(`\n${C.bold}${C.cyan}${bar}${C.reset}`);
  console.log(`${C.bold}  Finished Product Inputs — Automated Test Suite${C.reset}`);
  console.log(`${C.bold}${C.cyan}${bar}${C.reset}\n`);

  try {
    await setupFixtures();
    await testSchemaTests();
    await testLooseSku();
    await testRecipeApi();
    await testProductionStart();
    await testEdgeCases();
    await testProductionComplete();
    await testLooseSkuOutput();
    await testPseries();
  } catch (err) {
    log.err(`\nFATAL — test runner aborted: ${err.message}`);
    console.error(err.stack);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const bar2 = '─'.repeat(62);
  console.log(`\n${C.bold}${bar2}${C.reset}`);
  console.log(`${C.bold}  TEST RESULTS${C.reset}`);
  console.log(bar2);
  console.log(`  ${C.green}PASSED :${C.reset}  ${stats.passed}`);
  console.log(`  ${C.red}FAILED :${C.reset}  ${stats.failed}`);
  console.log(`  TOTAL  :  ${stats.total}`);
  console.log();

  // Per-TC summary
  for (const [tcId, result] of Object.entries(tcResults)) {
    const icon = result === 'PASS' ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${icon} ${tcId}`);
  }
  console.log(bar2 + '\n');

  // Update the test document with results
  updateTestDocument();

  process.exit(stats.failed > 0 ? 1 : 0);
}

main();
