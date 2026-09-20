import pg from 'pg';

const { Pool } = pg;

let pool;

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query(text, params = []) {
  return getDb().query(text, params);
}
