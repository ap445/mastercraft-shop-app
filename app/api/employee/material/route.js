import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function POST(request) {
  try {
    const auth = await requireSession(['employee','supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { materialId, customMaterialName, quantity, transactionType='issue', notes='' } = await request.json();
    const customName = typeof customMaterialName === 'string' ? customMaterialName.trim() : '';
    if (!materialId && !customName) return NextResponse.json({ error: 'Choose a material, or enter what you used.' }, { status: 400 });
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return NextResponse.json({ error: 'Enter a whole-number quantity greater than 0.' }, { status: 400 });
    if (!['issue','return'].includes(transactionType)) return NextResponse.json({ error: 'Invalid transaction type.' }, { status: 400 });
    const openR = await query('select job_id,operation_id from time_entries where employee_id=$1 and stopped_at is null limit 1', [auth.session.employeeId]);
    const open = openR.rows[0];
    if (!open) return NextResponse.json({ error: 'Clock in before recording material.' }, { status: 409 });
    let unitCost = null;
    if (materialId) {
      const matR = await query('select standard_cost from materials where id=$1', [materialId]);
      const mat = matR.rows[0];
      if (!mat) return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
      unitCost = mat.standard_cost;
    }
    const r = await query(
      `insert into material_transactions(job_id,operation_id,material_id,custom_material_name,employee_id,transaction_type,quantity,unit_cost,notes)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,occurred_at`,
      [open.job_id || null, open.operation_id || null, materialId || null, materialId ? null : customName, auth.session.employeeId, transactionType, qty, unitCost, notes]
    );
    return NextResponse.json({ transaction: r.rows[0] });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
