import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { getDb } from '../../../../lib/db';

export async function POST(request) {
  const db = getDb();
  const client = await db.connect();
  try {
    const auth = await requireSession(['employee', 'supervisor', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { operationId } = await request.json();
    if (!operationId) return NextResponse.json({ error: 'Operation is required.' }, { status: 400 });
    const employeeId = auth.session.employeeId;

    await client.query('begin');
    const assignment = await client.query('select id from assignments where employee_id=$1 and operation_id=$2', [employeeId, operationId]);
    if (!assignment.rows[0] && auth.session.role === 'employee') {
      await client.query('rollback');
      return NextResponse.json({ error: 'This operation is not assigned to you.' }, { status: 403 });
    }
    const opR = await client.query('select id,job_id,status from operations where id=$1', [operationId]);
    const op = opR.rows[0];
    if (!op) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Operation not found.' }, { status: 404 });
    }
    const openR = await client.query('select id from time_entries where employee_id=$1 and stopped_at is null limit 1', [employeeId]);
    if (openR.rows[0]) {
      await client.query('rollback');
      return NextResponse.json({ error: 'You already have an active job. Stop it before starting another.' }, { status: 409 });
    }
    const entryR = await client.query(
      `insert into time_entries(employee_id,job_id,operation_id,entry_type,started_at)
       values($1,$2,$3,'direct',now()) returning id,started_at`, [employeeId, op.job_id, op.id]
    );
    if (['queued','ready'].includes(op.status)) await client.query("update operations set status='in_progress' where id=$1", [op.id]);
    await client.query('commit');
    return NextResponse.json({ entry: entryR.rows[0] });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
