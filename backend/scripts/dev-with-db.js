const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const EmbeddedPostgres = require('embedded-postgres').default;

const DATA_DIR = path.join(__dirname, '../.pgdata');
const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/assetflow';
const DATABASE_NAME = 'assetflow';

async function applySchemaAndSeed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const seedPath = path.join(__dirname, '../src/db/seed.sql');

  await client.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('[dev-db] Schema applied');

  await client.query(fs.readFileSync(seedPath, 'utf8'));
  console.log('[dev-db] Seed data applied');

  await client.end();
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
  });

  const pgVersionPath = path.join(DATA_DIR, 'PG_VERSION');
  if (!fs.existsSync(pgVersionPath)) {
    console.log('[dev-db] Initializing embedded PostgreSQL...');
    await pg.initialise();
  } else {
    console.log('[dev-db] PostgreSQL already initialized, skipping initialization...');
  }
  await pg.start();
  console.log('[dev-db] PostgreSQL running on 127.0.0.1:5432');

  process.env.DATABASE_URL = DATABASE_URL;

  try {
    await pg.createDatabase(DATABASE_NAME);
    console.log(`[dev-db] Created database "${DATABASE_NAME}"`);
  } catch (err) {
    if (!err.message?.includes('already exists')) {
      throw err;
    }
    console.log(`[dev-db] Database "${DATABASE_NAME}" already exists`);
  }

  try {
    await applySchemaAndSeed();
  } catch (err) {
    console.warn('[dev-db] Schema/seed step failed:', err.message);
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(npmCmd, ['run', 'dev:server'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'inherit',
    shell: true,
  });

  const shutdown = async () => {
    server.kill();
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.on('exit', async (code) => {
    await pg.stop();
    process.exit(code ?? 0);
  });
}

main().catch(async (err) => {
  console.error('[dev-db] Failed to start development database:', err?.message || err);
  console.error('[dev-db] Install PostgreSQL or Docker, then run: npm run db:setup');
  process.exit(1);
});
