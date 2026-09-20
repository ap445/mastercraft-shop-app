import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function POST(request) {
  try {
    const auth = await requireSession(['employee','supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { materialId, quantity, transactionType='issue', notes='' } = await request.json();
    if (!materialId || !Number(quantity) || Number(quantity) <= 0) return NextResponse.json({ error: 'Material and positive quantity are required.' }, { status: 400 });
    if (!['issue','return'].includes(transactionType)) return NextResponse.json({ error: 'Invalid transaction type.' }, { status: 400 });
    const openR = await query('select job_id,operation_id from time_entries where employee_id=$1 and stopped_at is null limit 1', [auth.session.employeeId]);
    const open = openR.rows[0];
    if (!open?.job_id) return NextResponse.json({ error: 'Start a job before recording material.' }, { status: 409 });
    const matR = await query('select standard_cost from materials where id=$1', [materialId]);
    const mat = matR.rows[0];
    if (!mat) return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
    const r = await query(
      `insert into material_transactions(job_id,operation_id,material_id,employee_id,transaction_type,quantity,unit_cost,notes)
       values($1,$2,$3,$4,$5,$6,$7,$8) returning id,occurred_at`,
      [open.job_id, open.operation_id, materialId, auth.session.employeeId, transactionType, Number(quantity), mat.standard_cost, notes]
    );
    return NextResponse.json({ transaction: r.rows[0] });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
