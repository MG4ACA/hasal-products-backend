require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../models');

/**
 * ============================================================================
 * TEST DATA SEEDER - FOR COMPREHENSIVE TESTING
 * ============================================================================
 * Creates dedicated test data for:
 * - Recipe-SKU validation testing
 * - FIFO cost tracking testing
 * - Waste allocation testing
 * - Batch number generation testing
 * - Profit analysis testing
 * - Reporting endpoints testing
 * - E2E workflow testing
 *
 * Usage: node scripts/seed-test-data.js
 * ============================================================================
 */

const seedTestData = async () => {
  try {
    console.log('🧪 Starting TEST DATA seeding...');

    // Don't alter schema - tables already exist from migrations
    // Just verify connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection verified');

    // =========================================================================
    // 0. Get or Create Admin User for POs
    // =========================================================================
    console.log('Getting admin user...');
    let adminUser = await db.User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      // Create admin user if doesn't exist
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = await db.User.create({
        username: 'admin',
        password: hashedPassword,
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin',
        status: 'active',
      });
    }
    console.log('✅ Admin user ready');

    // =========================================================================
    // Clean up existing test data
    // =========================================================================
    console.log('Cleaning up existing test data...');

    // Delete test POs and related items (will cascade to batches)
    await db.PurchaseOrder.destroy({
      where: { po_number: { [db.Sequelize.Op.like]: 'TEST-PO-%' } },
    });

    // Delete test batches
    await db.RawMaterialBatch.destroy({
      where: { batch_number: { [db.Sequelize.Op.like]: 'TEST-BATCH-%' } },
    });

    // Delete test recipes
    const existingRecipes = await db.Recipe.findAll({
      where: { code: { [db.Sequelize.Op.like]: 'TEST-RECIPE-%' } },
    });
    for (const recipe of existingRecipes) {
      await db.RecipeItem.destroy({ where: { recipe_id: recipe.id } });
      await recipe.destroy();
    }

    // Delete test SKUs
    const existingProducts = await db.Product.findAll({
      where: { code: { [db.Sequelize.Op.like]: 'TEST-PROD-%' } },
    });
    for (const product of existingProducts) {
      await db.ProductSku.destroy({ where: { product_id: product.id } });
    }

    console.log('✅ Test data cleaned up');

    // =========================================================================
    // 1. Create Test Supplier
    // =========================================================================
    console.log('Creating test supplier...');
    const testSupplier = await db.Supplier.findOrCreate({
      where: { code: 'TEST-SUP' },
      defaults: {
        name: 'Test Supplier for Automated Tests',
        contact_person: 'Test Contact',
        phone: '0700000000',
        email: 'test@supplier.com',
        address: 'Test Address',
        payment_terms: 'credit',
        balance: 0,
        status: 'active',
      },
    });
    console.log('✅ Test supplier created');

    // =========================================================================
    // 2. Create Test Raw Materials (for FIFO testing)
    // =========================================================================
    console.log('Creating test raw materials...');

    const testMaterials = await Promise.all([
      db.RawMaterial.findOrCreate({
        where: { code: 'TEST-MAT-01' },
        defaults: {
          name: 'Test Turmeric (FIFO)',
          category: 'Test Spices',
          unit: 'kg',
          reorder_level: 10,
          status: 'active',
        },
      }),
      db.RawMaterial.findOrCreate({
        where: { code: 'TEST-MAT-02' },
        defaults: {
          name: 'Test Chili (FIFO)',
          category: 'Test Spices',
          unit: 'kg',
          reorder_level: 10,
          status: 'active',
        },
      }),
      db.RawMaterial.findOrCreate({
        where: { code: 'TEST-MAT-03' },
        defaults: {
          name: 'Test Coriander (FIFO)',
          category: 'Test Spices',
          unit: 'kg',
          reorder_level: 10,
          status: 'active',
        },
      }),
    ]);

    const [material1] = testMaterials[0];
    const [material2] = testMaterials[1];
    const [material3] = testMaterials[2];

    console.log('✅ Test materials created');

    // =========================================================================
    // 3. Create Test Products with Known Profit Margins
    // =========================================================================
    console.log('Creating test products...');

    const testProducts = await Promise.all([
      db.Product.findOrCreate({
        where: { code: 'TEST-PROD-01' },
        defaults: {
          name: 'Test Premium Curry (High Margin)',
          category: 'Test Products',
          barcode: 'TEST-PROD-01-BAR',
          description: 'Test product for profit margin testing - 40% margin',
          status: 'active',
        },
      }),
      db.Product.findOrCreate({
        where: { code: 'TEST-PROD-02' },
        defaults: {
          name: 'Test Economy Mix (Low Margin)',
          category: 'Test Products',
          barcode: 'TEST-PROD-02-BAR',
          description: 'Test product for profit margin testing - 15% margin',
          status: 'active',
        },
      }),
      db.Product.findOrCreate({
        where: { code: 'TEST-PROD-03' },
        defaults: {
          name: 'Test Waste Tracker',
          category: 'Test Products',
          barcode: 'TEST-PROD-03-BAR',
          description: 'Test product for waste allocation testing',
          status: 'active',
        },
      }),
    ]);

    const [product1] = testProducts[0];
    const [product2] = testProducts[1];
    const [product3] = testProducts[2];

    console.log('✅ Test products created');

    // =========================================================================
    // 4. Create Test Product SKUs with Specific Pricing
    // =========================================================================
    console.log('Creating test SKUs...');

    const testSkus = await Promise.all([
      // Product 1 - High Margin (40%)
      // Selling Price: 1000, Target Cost: 600, Margin: 40%
      db.ProductSku.findOrCreate({
        where: {
          product_id: product1.id,
          size: '100g',
        },
        defaults: {
          unit: 'g',
          barcode: 'TEST-SKU-01-100G',
          price: 1000, // LKR 1000
          current_stock: 0,
          average_cost: 0, // Will be updated by production
          status: 'active',
        },
      }),
      db.ProductSku.findOrCreate({
        where: {
          product_id: product1.id,
          size: '500g',
        },
        defaults: {
          unit: 'g',
          barcode: 'TEST-SKU-01-500G',
          price: 4500, // LKR 4500
          current_stock: 0,
          average_cost: 0,
          status: 'active',
        },
      }),

      // Product 2 - Low Margin (15%)
      // Selling Price: 800, Target Cost: 680, Margin: 15%
      db.ProductSku.findOrCreate({
        where: {
          product_id: product2.id,
          size: '100g',
        },
        defaults: {
          unit: 'g',
          barcode: 'TEST-SKU-02-100G',
          price: 800, // LKR 800
          current_stock: 0,
          average_cost: 0,
          status: 'active',
        },
      }),

      // Product 3 - Waste Testing
      db.ProductSku.findOrCreate({
        where: {
          product_id: product3.id,
          size: '100g',
        },
        defaults: {
          unit: 'g',
          barcode: 'TEST-SKU-03-100G',
          price: 1200,
          current_stock: 0,
          average_cost: 0,
          status: 'active',
        },
      }),
    ]);

    const [sku1_100g] = testSkus[0];
    const [sku1_500g] = testSkus[1];
    const [sku2_100g] = testSkus[2];
    const [sku3_100g] = testSkus[3];

    console.log('✅ Test SKUs created');

    // =========================================================================
    // 5. Create Test Recipes with SKU Relationships
    // =========================================================================
    console.log('Creating test recipes...');

    // Recipe 1: High Margin Product (40% margin)
    // Material cost target: ~600 LKR per kg
    const [recipe1, created1] = await db.Recipe.findOrCreate({
      where: { code: 'TEST-RECIPE-01' },
      defaults: {
        product_id: product1.id,
        product_sku_id: sku1_100g.id, // Links to 100g SKU
        name: 'Test Recipe - Premium Curry',
        expected_yield: 1.0, // 1 kg output
        yield_unit: 'kg',
        is_active: true,
        notes: 'Test recipe for high margin product',
      },
    });

    if (created1) {
      // Add recipe items (3 materials)
      await db.RecipeItem.bulkCreate([
        {
          recipe_id: recipe1.id,
          material_id: material1.id,
          quantity: 0.4, // 400g turmeric @ 1000/kg = 400
          unit: 'kg',
        },
        {
          recipe_id: recipe1.id,
          material_id: material2.id,
          quantity: 0.3, // 300g chili @ 500/kg = 150
          unit: 'kg',
        },
        {
          recipe_id: recipe1.id,
          material_id: material3.id,
          quantity: 0.3, // 300g coriander @ 300/kg = 90
          unit: 'kg',
        },
      ]);
      // Total cost: 400 + 150 + 90 = 640 LKR/kg
      // For 100g SKU: 64 LKR cost, selling 100 LKR → 36% margin (close to 40%)
    }

    // Recipe 2: Low Margin Product (15% margin)
    // Material cost target: ~680 LKR per kg
    const [recipe2, created2] = await db.Recipe.findOrCreate({
      where: { code: 'TEST-RECIPE-02' },
      defaults: {
        product_id: product2.id,
        product_sku_id: sku2_100g.id, // Links to 100g SKU
        name: 'Test Recipe - Economy Mix',
        expected_yield: 1.0,
        yield_unit: 'kg',
        is_active: true,
        notes: 'Test recipe for low margin product',
      },
    });

    if (created2) {
      await db.RecipeItem.bulkCreate([
        {
          recipe_id: recipe2.id,
          material_id: material1.id,
          quantity: 0.5, // 500g @ 1000/kg = 500
          unit: 'kg',
        },
        {
          recipe_id: recipe2.id,
          material_id: material2.id,
          quantity: 0.3, // 300g @ 500/kg = 150
          unit: 'kg',
        },
        {
          recipe_id: recipe2.id,
          material_id: material3.id,
          quantity: 0.2, // 200g @ 300/kg = 60
          unit: 'kg',
        },
      ]);
      // Total cost: 500 + 150 + 60 = 710 LKR/kg
      // For 100g SKU: 71 LKR cost, selling 80 LKR → 11% margin (close to 15%)
    }

    // Recipe 3: Waste Testing
    const [recipe3, created3] = await db.Recipe.findOrCreate({
      where: { code: 'TEST-RECIPE-03' },
      defaults: {
        product_id: product3.id,
        product_sku_id: sku3_100g.id,
        name: 'Test Recipe - Waste Tracker',
        expected_yield: 1.0,
        yield_unit: 'kg',
        is_active: true,
        notes: 'Test recipe for waste allocation testing',
      },
    });

    if (created3) {
      await db.RecipeItem.bulkCreate([
        {
          recipe_id: recipe3.id,
          material_id: material1.id,
          quantity: 0.6,
          unit: 'kg',
        },
        {
          recipe_id: recipe3.id,
          material_id: material2.id,
          quantity: 0.4,
          unit: 'kg',
        },
      ]);
    }

    console.log('✅ Test recipes created');

    // =========================================================================
    // 6. Create Test POs and Batches for FIFO Testing
    // =========================================================================
    console.log('Creating test purchase orders and batches...');

    // PO 1: Material 1 @ 1000/kg (Batch 1)
    const po1 = await db.PurchaseOrder.create({
      po_number: 'TEST-PO-001',
      supplier_id: testSupplier[0].id,
      order_date: '2024-12-01',
      expected_date: '2024-12-05',
      status: 'received',
      total_amount: 10000,
      created_by: adminUser.id,
    });

    await db.PoItem.create({
      po_id: po1.id,
      material_id: material1.id,
      quantity: 10, // 10 kg
      unit_cost: 1000,
      received_quantity: 10,
      total_amount: 10000,
    });

    const batch1_mat1 = await db.RawMaterialBatch.create({
      purchase_order_id: po1.id,
      material_id: material1.id,
      supplier_id: testSupplier[0].id,
      batch_number: 'TEST-BATCH-01-MAT1',
      batch_type: 'receipt',
      quantity: 10,
      unit_cost: 1000, // Old cost
      expiry_date: '2025-12-01',
      purchase_date: '2024-12-05',
      inspection_status: 'approved',
      accepted_quantity: 10,
    });

    // PO 2: Material 1 @ 1200/kg (Batch 2 - Higher cost for FIFO)
    const po2 = await db.PurchaseOrder.create({
      po_number: 'TEST-PO-002',
      supplier_id: testSupplier[0].id,
      order_date: '2024-12-10',
      expected_date: '2024-12-15',
      status: 'received',
      total_amount: 12000,
      created_by: adminUser.id,
    });

    await db.PoItem.create({
      po_id: po2.id,
      material_id: material1.id,
      quantity: 10,
      unit_cost: 1200,
      received_quantity: 10,
      total_amount: 12000,
    });

    const batch2_mat1 = await db.RawMaterialBatch.create({
      purchase_order_id: po2.id,
      material_id: material1.id,
      supplier_id: testSupplier[0].id,
      batch_number: 'TEST-BATCH-02-MAT1',
      batch_type: 'receipt',
      quantity: 10,
      unit_cost: 1200, // New higher cost
      expiry_date: '2025-12-10',
      purchase_date: '2024-12-15',
      inspection_status: 'approved',
      accepted_quantity: 10,
    });

    // PO 3: Material 2 @ 500/kg
    const po3 = await db.PurchaseOrder.create({
      po_number: 'TEST-PO-003',
      supplier_id: testSupplier[0].id,
      order_date: '2024-12-01',
      expected_date: '2024-12-05',
      status: 'received',
      total_amount: 5000,
      created_by: adminUser.id,
    });

    await db.PoItem.create({
      po_id: po3.id,
      material_id: material2.id,
      quantity: 10,
      unit_cost: 500,
      received_quantity: 10,
      total_amount: 5000,
    });

    const batch1_mat2 = await db.RawMaterialBatch.create({
      purchase_order_id: po3.id,
      material_id: material2.id,
      supplier_id: testSupplier[0].id,
      batch_number: 'TEST-BATCH-01-MAT2',
      batch_type: 'receipt',
      quantity: 10,
      unit_cost: 500,
      expiry_date: '2025-12-01',
      purchase_date: '2024-12-05',
      inspection_status: 'approved',
      accepted_quantity: 10,
    });

    // PO 4: Material 3 @ 300/kg
    const po4 = await db.PurchaseOrder.create({
      po_number: 'TEST-PO-004',
      supplier_id: testSupplier[0].id,
      order_date: '2024-12-01',
      expected_date: '2024-12-05',
      status: 'received',
      total_amount: 3000,
      created_by: adminUser.id,
    });

    await db.PoItem.create({
      po_id: po4.id,
      material_id: material3.id,
      quantity: 10,
      unit_cost: 300,
      received_quantity: 10,
      total_amount: 3000,
    });

    const batch1_mat3 = await db.RawMaterialBatch.create({
      purchase_order_id: po4.id,
      material_id: material3.id,
      supplier_id: testSupplier[0].id,
      batch_number: 'TEST-BATCH-01-MAT3',
      batch_type: 'receipt',
      quantity: 10,
      unit_cost: 300,
      expiry_date: '2025-12-01',
      purchase_date: '2024-12-05',
      inspection_status: 'approved',
      accepted_quantity: 10,
    });

    console.log('✅ Test purchase orders and batches created');

    // =========================================================================
    // 7. Create Test Outlets for Sales Testing
    // =========================================================================
    console.log('Creating test outlet...');

    const [testOutlet] = await db.Outlet.findOrCreate({
      where: { code: 'TEST-OUT' },
      defaults: {
        name: 'Test Outlet - Automated',
        route_id: null,
        contact_person: 'Test Manager',
        phone: '0700000001',
        address: 'Test Outlet Address',
        customer_type: 'retailer',
        balance: 0,
        status: 'active',
      },
    });

    console.log('✅ Test outlet created');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST DATA SEEDING COMPLETED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Created Test Data:');
    console.log('  • 1 Test Supplier (TEST-SUP)');
    console.log('  • 3 Test Raw Materials (TEST-MAT-01, 02, 03)');
    console.log('  • 3 Test Products (TEST-PROD-01, 02, 03)');
    console.log('  • 4 Test SKUs with pricing for profit testing');
    console.log('  • 3 Test Recipes with SKU relationships');
    console.log('  • 4 Test Purchase Orders');
    console.log('  • 4 Test Batches for FIFO testing:');
    console.log('    - Batch 1 Mat1: 10kg @ 1000/kg (old)');
    console.log('    - Batch 2 Mat1: 10kg @ 1200/kg (new)');
    console.log('    - Batch 1 Mat2: 10kg @ 500/kg');
    console.log('    - Batch 1 Mat3: 10kg @ 300/kg');
    console.log('  • 1 Test Outlet');
    console.log('');
    console.log('🧪 Ready for Comprehensive Testing:');
    console.log('  ✓ Recipe-SKU validation');
    console.log('  ✓ FIFO cost tracking (2 batches at different costs)');
    console.log('  ✓ Waste allocation & tracking');
    console.log('  ✓ Batch number generation');
    console.log('  ✓ Profit analysis (high/low margin products)');
    console.log('  ✓ Reporting endpoints');
    console.log('  ✓ E2E workflows');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
};

// Run seeder
seedTestData();
