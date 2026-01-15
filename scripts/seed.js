require('dotenv').config();
const db = require('../models');
const seedDatabase = require('./seeders');

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    // Use alter: true to safely sync schema without data loss
    // Seeders.js has duplicate protection - won't re-seed if data exists
    await db.sequelize.sync({ alter: true });

    await seedDatabase();

    console.log('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seed();
