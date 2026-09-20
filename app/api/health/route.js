import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET() {
  try {
    await query('select 1');
    return NextResponse.json({ ok: true, database: 'connected' });
  } catch (e) {
    return NextResponse.json({ ok: false, database: 'unavailable', error: e.message }, { status: 503 });
  }
}
