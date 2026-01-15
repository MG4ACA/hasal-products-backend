require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Initialize database - creates database if it doesn't exist
 * This script should be run before starting the application
 */
const initializeDatabase = async () => {
  try {
    console.log('Starting database initialization...');

    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('Connected to MySQL server');

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
    console.log('Database initialization completed successfully\n');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
