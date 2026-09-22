import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const auth = await requireSession(['admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [jobsR, timeR, materialR, jobMaterialsR] = await Promise.all([
      query(`select j.id, j.job_number, j.customer_name, j.description, j.status, j.due_date, j.priority,
                    coalesce((select sum(o.estimated_hours) from operations o where o.job_id=j.id),0) as estimated_hours,
                    (select count(*) from operations o where o.job_id=j.id) as operations_total,
                    (select count(*) from operations o where o.job_id=j.id and o.status='complete') as operations_complete
             from jobs j
             order by j.created_at desc`),
      query(`select te.id, te.job_id, te.operation_id, te.employee_id, te.entry_type, te.started_at, te.stopped_at,
                    e.full_name as employee_name,
                    o.operation_name, o.sequence_no,
                    j.job_number,
                    extract(epoch from (coalesce(te.stopped_at, now()) - te.started_at))/3600.0 as hours
             from time_entries te
             join employees e on e.id=te.employee_id
             left join operations o on o.id=te.operation_id
             left join jobs j on j.id=te.job_id
             order by te.started_at desc`),
      query(`select mt.id, mt.job_id, mt.operation_id, mt.material_id, mt.custom_material_name, mt.employee_id, mt.transaction_type, mt.quantity, mt.unit_cost, mt.occurred_at, mt.notes,
                    m.item_code, coalesce(m.description, mt.custom_material_name) as material_description, m.unit_of_measure,
                    e.full_name as employee_name,
                    j.job_number
             from material_transactions mt
             left join materials m on m.id=mt.material_id
             join employees e on e.id=mt.employee_id
             left join jobs j on j.id=mt.job_id
             order by mt.occurred_at desc`),
      query(`select jm.id, jm.job_id, jm.material_id, jm.planned_quantity, jm.notes,
                    m.item_code, m.description as material_description, m.unit_of_measure, m.standard_cost
             from job_materials jm
             join materials m on m.id=jm.material_id
             order by m.item_code`)
    ]);

    return NextResponse.json({ jobs: jobsR.rows, timeEntries: timeR.rows, materialTransactions: materialR.rows, jobMaterials: jobMaterialsR.rows });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unable to load job costing data.' }, { status: 500 });
  }
}
