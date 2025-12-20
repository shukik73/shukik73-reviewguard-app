import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addAdminAuthColumn() {
  try {
    await pool.query(`
      ALTER TABLE user_settings 
      ADD COLUMN IF NOT EXISTS admin_auth_enabled BOOLEAN DEFAULT false
    `);
    console.log('✅ Added admin_auth_enabled column to user_settings');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

addAdminAuthColumn();
