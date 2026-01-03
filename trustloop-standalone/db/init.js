require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDatabase() {
  console.log('Initializing TrustLoop database...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);

    console.log('Database initialized successfully!');
    console.log('Tables created:');
    console.log('  - users');
    console.log('  - customers');
    console.log('  - customer_journeys');
    console.log('  - smart_dnd');
    console.log('  - invite_history');
    console.log('  - session');
    console.log('  - journey_analytics (view)');

  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
