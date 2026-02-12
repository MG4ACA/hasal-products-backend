const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Seed products and SKUs from productList.csv
 * CSV contains product info with multiple SKU rows per product
 */
const seedProducts = async () => {
  try {
    // Check if products already exist
    const productCount = await db.Product.count();
    if (productCount > 0) {
      console.log('⚠️  Products already exist, skipping product seeding');
      return;
    }

    console.log('Seeding Products and SKUs from CSV...');

    // Read product list CSV file
    const csvPath = path.join(__dirname, 'data-collection', 'productList.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Product CSV file not found at ${csvPath}`);
      console.error('Please ensure productList.csv exists in data-collection folder');
      return;
    }

    const csvRows = [];
    const productsMap = new Map(); // Track unique products by code
    const skusByProduct = new Map(); // Track SKUs by product code

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', row => {
          csvRows.push(row);

          const productCode = row.product_code.trim();

          // Store unique product info
          if (!productsMap.has(productCode)) {
            productsMap.set(productCode, {
              code: productCode,
              name: row.product_name.trim(),
              category: row.product_category.trim(),
              barcode: row.product_barcode.trim() || null,
              description: row.product_description.trim() || null,
              status: row.status.trim(),
            });
            skusByProduct.set(productCode, []);
          }

          // Store SKU info for this product
          skusByProduct.get(productCode).push({
            size: row.sku_size.trim(),
            unit: row.sku_unit.trim(),
            barcode: row.sku_barcode.trim() || null,
            price: parseFloat(row.sku_price),
            status: row.status.trim(),
          });
        })
        .on('end', async () => {
          try {
            if (productsMap.size === 0) {
              console.warn('⚠️  No products found in CSV file');
              resolve();
              return;
            }

            console.log(
              `📦 Found ${productsMap.size} unique products with ${csvRows.length} total SKUs`
            );

            // Create products first
            const productsToCreate = Array.from(productsMap.values());
            const createdProducts = await db.Product.bulkCreate(productsToCreate);
            console.log(`✅ Created ${createdProducts.length} products`);

            // Create a mapping of product codes to IDs
            const productCodeToIdMap = new Map();
            createdProducts.forEach(product => {
              productCodeToIdMap.set(product.code, product.id);
            });

            // Now create all SKUs with product_id references
            const skusToCreate = [];
            for (const [productCode, skus] of skusByProduct.entries()) {
              const productId = productCodeToIdMap.get(productCode);
              skus.forEach(sku => {
                skusToCreate.push({
                  product_id: productId,
                  size: sku.size,
                  unit: sku.unit,
                  barcode: sku.barcode,
                  price: sku.price,
                  average_cost: 0.0,
                  material_cost: 0.0,
                  overhead_cost: 0.0,
                  cost_last_updated: null,
                  current_stock: 0.0,
                  status: sku.status,
                });
              });
            }

            await db.ProductSku.bulkCreate(skusToCreate);
            console.log(`✅ Created ${skusToCreate.length} product SKUs`);

            // Show sample products
            console.log('Sample products:');
            createdProducts.slice(0, 5).forEach(product => {
              const skuCount = skusByProduct.get(product.code).length;
              console.log(`  - ${product.code}: ${product.name} (${skuCount} SKUs)`);
            });

            // Show category breakdown
            const categoryCount = new Map();
            productsToCreate.forEach(p => {
              categoryCount.set(p.category, (categoryCount.get(p.category) || 0) + 1);
            });
            console.log('\n📊 Products by category:');
            for (const [category, count] of categoryCount.entries()) {
              console.log(`  - ${category}: ${count} products`);
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
    throw error;
  }
};

module.exports = seedProducts;
