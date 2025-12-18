require('dotenv').config();
const db = require('../models');
const seedDatabase = require('./seeders');

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    await db.sequelize.sync({ force: true });

    await seedDatabase();

    console.log('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seed();
