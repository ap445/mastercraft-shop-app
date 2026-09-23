import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { getDb } from '../../../../lib/db';

// Lets an employee clock in directly against a job, with no operation/assignment
// needed first — the simple path alongside the department-scheduled one.
export async function POST(request) {
  const db = getDb();
  const client = await db.connect();
  try {
    const auth = await requireSession(['employee', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: 'Choose a job.' }, { status: 400 });
    const employeeId = auth.session.employeeId;

    await client.query('begin');
    const jobR = await client.query('select id,status from jobs where id=$1', [jobId]);
    const job = jobR.rows[0];
    if (!job) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    if (['complete', 'closed'].includes(job.status)) {
      await client.query('rollback');
      return NextResponse.json({ error: 'That job is marked complete or closed — ask your admin to reopen it first.' }, { status: 409 });
    }
    const openR = await client.query('select id from time_entries where employee_id=$1 and stopped_at is null limit 1', [employeeId]);
    if (openR.rows[0]) {
      await client.query('rollback');
      return NextResponse.json({ error: 'You already have an active job. Stop it before starting another.' }, { status: 409 });
    }
    const entryR = await client.query(
      `insert into time_entries(employee_id,job_id,entry_type,started_at)
       values($1,$2,'direct',now()) returning id,started_at`, [employeeId, job.id]
    );
    if (job.status === 'not_started') await client.query("update jobs set status='in_progress' where id=$1", [job.id]);
    await client.query('commit');
    return NextResponse.json({ entry: entryR.rows[0] });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
