const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Seed outlets from enriched CSV file
 * The CSV is already enriched with all required fields
 */
const seedOutlets = async () => {
  try {
    // Check if outlets already exist
    const outletCount = await db.Outlet.count();
    if (outletCount > 0) {
      console.log('⚠️  Outlets already exist, skipping outlet seeding');
      return;
    }

    console.log('Seeding Outlets from enriched CSV...');

    // Read enriched CSV file
    const csvPath = path.join(__dirname, 'data-collection', 'outlets_enriched.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Enriched CSV file not found at ${csvPath}`);
      console.error('Please run enrich-outlets-csv.py first to create outlets_enriched.csv');
      return;
    }

    const outlets = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', row => {
          outlets.push({
            code: row.code,
            name: row.name,
            address: row.address,
            route_id: parseInt(row.route_id),
            status: row.status,
            payment_terms: row.payment_terms,
            default_discount: parseFloat(row.default_discount),
            owner_name: row.owner_name || null,
            phone: row.phone || null,
            email: row.email || null,
          });
        })
        .on('end', async () => {
          try {
            if (outlets.length === 0) {
              console.warn('⚠️  No outlets found in enriched CSV file');
              resolve();
              return;
            }

            // Bulk create outlets
            await db.Outlet.bulkCreate(outlets);
            console.log(`✅ Created ${outlets.length} outlets`);
            console.log('Sample outlets:');
            outlets.slice(0, 5).forEach(outlet => {
              console.log(`  - ${outlet.code}: ${outlet.name} (Route ID: ${outlet.route_id})`);
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error seeding outlets:', error.message);
    throw error;
  }
};

module.exports = seedOutlets;
