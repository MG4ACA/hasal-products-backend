require('dotenv').config();
const db = require('../models');
const seedDatabase = require('./seeders');
const seedProducts = require('./seed-products');

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clean up orphaned records before schema sync
    console.log('🧹 Cleaning up orphaned records...');
    try {
      // Delete orphaned recipe items (recipes were removed from seeding)
      await db.sequelize.query(
        'DELETE FROM recipe_items WHERE recipe_id NOT IN (SELECT id FROM recipes)',
        {
          type: db.sequelize.QueryTypes.DELETE,
        }
      );
      console.log('✅ Cleaned up orphaned recipe items');
    } catch (cleanupError) {
      console.log('⚠️  Cleanup warning (safe to ignore):', cleanupError.message);
    }

    // Use alter: true to safely sync schema without data loss
    // Seeders.js has duplicate protection - won't re-seed if data exists
    await db.sequelize.sync({ alter: true });

    // Seed base data (users, routes, suppliers, materials, etc.)
    await seedDatabase();

    // Seed products and SKUs from CSV
    await seedProducts();

    console.log('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seed();
