const { sequelize } = require('../models');
const path = require('path');
const fs = require('fs').promises;

async function runMigrations() {
  try {
    console.log('Starting migrations...');

    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(f => f.endsWith('.js')).sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`\nRunning migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));

      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log(`✓ ${file} completed successfully`);
    }

    console.log('\n✓ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigrations();
