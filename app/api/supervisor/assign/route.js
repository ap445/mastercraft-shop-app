import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function POST(request) {
  try {
    const auth = await requireSession(['supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { operationId, employeeId } = await request.json();
    if (!operationId || !employeeId) return NextResponse.json({ error: 'Operation and employee are required.' }, { status: 400 });
    const r = await query(
      `insert into assignments(operation_id,employee_id) values($1,$2)
       on conflict(operation_id,employee_id) do update set assigned_at=assignments.assigned_at
       returning *`, [operationId, employeeId]
    );
    return NextResponse.json({ assignment: r.rows[0] });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
