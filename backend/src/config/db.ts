import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/assetflow';

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Helper for running queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('[Database Query]', { text, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[Database Query Error]', { text, error });
    throw error;
  }
}

// Helper for running transactions safely
export async function runInTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Database Transaction Rollback]', error);
    throw error;
  } finally {
    client.release();
  }
}
