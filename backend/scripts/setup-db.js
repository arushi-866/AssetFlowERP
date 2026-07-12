const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/assetflow';

function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
  const database = url.pathname.replace(/^\//, '') || 'assetflow';
  const adminUrl = connectionString.replace(/\/[^/]+$/, '/postgres');
  return { database, adminUrl };
}

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
    console.warn('[db:setup] Failed to fetch from randomuser.me, using local randomizer:', err.message);
  }
  
  const shuffled = [...RANDOM_NAMES_FALLBACK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 2);
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

  // Fetch dynamic users
  console.log('[db:setup] Fetching dynamic users for real-time data...');
  const dynamicUsers = await getDynamicUsers();
  console.log('[db:setup] Seeding with dynamic users:', dynamicUsers);

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
  console.log('[db:setup] Dynamic seed data applied');

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
