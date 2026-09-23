import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { getDb } from '../../../../lib/db';

export async function POST(request) {
  const db = getDb();
  const client = await db.connect();
  try {
    const auth = await requireSession(['employee','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    await client.query('begin');
    const openR = await client.query('select id from time_entries where employee_id=$1 and stopped_at is null limit 1 for update', [auth.session.employeeId]);
    const open = openR.rows[0];
    if (!open) {
      await client.query('rollback');
      return NextResponse.json({ error: 'No active job to stop.' }, { status: 409 });
    }
    await client.query('update time_entries set stopped_at=now(), notes=$2 where id=$1', [open.id, notes || null]);
    await client.query('commit');
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
