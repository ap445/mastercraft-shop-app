import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function POST(request) {
  try {
    const auth = await requireSession(['supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { operationId, status } = await request.json();
    const allowed = ['queued','ready','in_progress','paused','blocked','complete'];
    if (!operationId || !allowed.includes(status)) return NextResponse.json({ error: 'Invalid operation status.' }, { status: 400 });
    const r = await query(
      `update operations set status=$2, completed_at=case when $2='complete' then now() else null end where id=$1 returning *`,
      [operationId, status]
    );
    return NextResponse.json({ operation: r.rows[0] });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
