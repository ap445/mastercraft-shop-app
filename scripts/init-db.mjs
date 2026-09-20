import fs from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
try {
  const sql = await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Mastercraft database schema is ready.');
} finally {
  await client.end();
}
