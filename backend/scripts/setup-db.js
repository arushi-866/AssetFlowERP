const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/assetflow';

function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
  const database = url.pathname.replace(/^\//, '') || 'assetflow';
  const adminUrl = connectionString.replace(/\/[^/]+$/, '/postgres');
  return { database, adminUrl };
}

async function setup() {
  const { database, adminUrl } = parseDatabaseUrl(DATABASE_URL);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();

  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database}"`);
    console.log(`[db:setup] Created database "${database}"`);
  } else {
    console.log(`[db:setup] Database "${database}" already exists`);
  }
  await admin.end();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const seedPath = path.join(__dirname, '../src/db/seed.sql');

  await client.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('[db:setup] Schema applied');

  await client.query(fs.readFileSync(seedPath, 'utf8'));
  console.log('[db:setup] Seed data applied');

  await client.end();
  console.log('[db:setup] Done');
}

setup().catch((err) => {
  console.error('[db:setup] Failed:', err.message);
  console.error(
    '[db:setup] Start PostgreSQL first, then run: npm run db:setup\n' +
      '  Docker: docker compose up -d\n' +
      '  Local: install PostgreSQL and set DATABASE_URL in backend/.env'
  );
  process.exit(1);
});
