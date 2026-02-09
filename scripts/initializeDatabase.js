require('dotenv').config();
const mysql = require('mysql2/promise');
const seedDatabase = require('./seeders');
const seedOutlets = require('./seed-outlets');
const db = require('../models');

/**
 * Initialize database - creates database if it doesn't exist
 * Syncs models and seeds initial data (routes, users, suppliers, outlets)
 * This script should be run before starting the application
 */
const initializeDatabase = async () => {
  try {
    console.log('🚀 Starting database initialization...\n');

    // Step 1: Create database if it doesn't exist
    console.log('📦 Step 1: Checking/Creating database...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('✓ Connected to MySQL server');

    const dbName = process.env.DB_NAME || 'hasal_pos_dev';

    // Check if database exists
    const [databases] = await connection.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );

    if (databases.length === 0) {
      console.log(`Database '${dbName}' does not exist. Creating...`);
      await connection.query(
        `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      console.log(`✓ Database '${dbName}' created successfully`);
    } else {
      console.log(`✓ Database '${dbName}' already exists`);
    }

    await connection.end();

    // Step 2: Sync database schema
    console.log('\n📊 Step 2: Syncing database schema...');
    await db.sequelize.sync({ alter: true });
    console.log('✓ Database schema synchronized');

    // Step 3: Seed core data (routes, users, suppliers)
    console.log('\n🌱 Step 3: Seeding core data (routes, users, suppliers)...');
    await seedDatabase();

    // Step 4: Seed outlets from CSV
    console.log('\n🏪 Step 4: Seeding outlets from CSV...');
    await seedOutlets();

    console.log('\n✅ Database initialization completed successfully!\n');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
