const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const EmbeddedPostgres = require('embedded-postgres').default;
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../.pgdata');
const DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/assetflow';
const DATABASE_NAME = 'assetflow';

const RANDOM_NAMES_FALLBACK = [
  { name: 'Amit Sharma', email: 'amit.sharma@company.com' },
  { name: 'Sunita Patel', email: 'sunita.patel@company.com' },
  { name: 'Vikram Singh', email: 'vikram.singh@company.com' },
  { name: 'Kavita Rao', email: 'kavita.rao@company.com' },
  { name: 'Rahul Verma', email: 'rahul.verma@company.com' },
  { name: 'Anjali Gupta', email: 'anjali.gupta@company.com' },
  { name: 'David Smith', email: 'david.smith@company.com' },
  { name: 'Sarah Connor', email: 'sarah.connor@company.com' },
  { name: 'John Doe', email: 'john.doe@company.com' },
  { name: 'Emma Watson', email: 'emma.watson@company.com' }
];

async function getDynamicUsers() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('https://randomuser.me/api/?results=2&nat=in,us,gb', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length === 2) {
        return data.results.map((user) => {
          const first = user.name.first;
          const last = user.name.last;
          const fullName = `${first} ${last}`;
          const cleanFirst = first.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanLast = last.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanEmail = `${cleanFirst}.${cleanLast}@company.com`;
          return { name: fullName, email: cleanEmail };
        });
      }
    }
  } catch (err) {
    console.warn('[dev-db] Failed to fetch from randomuser.me, using local randomizer:', err.message);
  }
  
  const shuffled = [...RANDOM_NAMES_FALLBACK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 2);
}

async function applySchemaAndSeed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const seedPath = path.join(__dirname, '../src/db/seed.sql');

  await client.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('[dev-db] Schema applied');

  // Fetch dynamic users
  console.log('[dev-db] Fetching dynamic users for real-time data...');
  const dynamicUsers = await getDynamicUsers();
  console.log('[dev-db] Seeding with dynamic users:', dynamicUsers);

  const staticUsers = [
    { name: 'Aditi Rao', email: 'admin@company.com' },
    { name: 'Rohan Mehta', email: 'manager@company.com' }
  ];

  let seedSql = fs.readFileSync(seedPath, 'utf8');
  for (let i = 0; i < 2; i++) {
    const staticUser = staticUsers[i];
    const dynamicUser = dynamicUsers[i];
    
    // Replace names
    const nameRegex = new RegExp(staticUser.name, 'g');
    seedSql = seedSql.replace(nameRegex, dynamicUser.name);
    
    // Replace emails
    const emailRegex = new RegExp(staticUser.email, 'g');
    seedSql = seedSql.replace(emailRegex, dynamicUser.email);
  }

  // Generate dynamic password hash to avoid hardcoding any hashes
  const dynamicHash = await bcrypt.hash('password123', 10);
  const hardcodedHash = '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82';
  seedSql = seedSql.replaceAll(hardcodedHash, dynamicHash);

  await client.query(seedSql);
  console.log('[dev-db] Dynamic seed data applied');

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
