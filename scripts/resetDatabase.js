const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'hasal_pos_dev',
  });

  try {
    console.log('Disabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS=0');

    console.log('Getting list of tables...');
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
      [process.env.DB_NAME || 'hasal_pos_dev']
    );

    console.log(`Found ${tables.length} tables. Dropping them...`);
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`  Dropping ${tableName}...`);
      await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    }

    console.log('Re-enabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS=1');

    console.log('✅ Database reset complete');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  } finally {
    await connection.end();
  }
}

resetDatabase();
