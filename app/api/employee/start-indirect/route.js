import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function POST(request) {
  try {
    const auth = await requireSession(['employee', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { entryType } = await request.json().catch(() => ({}));
    if (!['indirect', 'training', 'break'].includes(entryType)) return NextResponse.json({ error: 'Choose a valid time type.' }, { status: 400 });
    const employeeId = auth.session.employeeId;
    const openR = await query('select id from time_entries where employee_id=$1 and stopped_at is null limit 1', [employeeId]);
    if (openR.rows[0]) return NextResponse.json({ error: 'You already have an active timer. Stop it before starting another.' }, { status: 409 });
    const r = await query(
      `insert into time_entries(employee_id,entry_type,started_at) values ($1,$2,now()) returning id,started_at`,
      [employeeId, entryType]
    );
    return NextResponse.json({ entry: r.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
