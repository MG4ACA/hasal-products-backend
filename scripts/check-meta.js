require('dotenv').config();
const { Sequelize } = require('sequelize');
const seq = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false,
});
seq.query('SELECT name FROM SequelizeMeta ORDER BY name').then(([rows]) => {
  rows.forEach(r => console.log(r.name));
  seq.close();
}).catch(e => { console.error(e.message); seq.close(); });
