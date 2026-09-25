import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const auth = await requireSession(['employee', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const employeeId = auth.session.employeeId;

    const [employeeR, activeR, openJobsR, materialsR] = await Promise.all([
      query(`select id,employee_code,full_name,role from employees where id=$1`, [employeeId]),
      query(`select te.id,te.started_at,te.entry_type,
                    case when j.id is null then null else
                      json_build_object('id',j.id,'job_number',j.job_number,'description',j.description)
                    end as jobs
             from time_entries te
             left join jobs j on j.id=te.job_id
             where te.employee_id=$1 and te.stopped_at is null limit 1`, [employeeId]),
      query(`select id,job_number,customer_name,description,due_date,priority
             from jobs where status not in ('complete','closed')
             order by priority asc, due_date asc nulls last, job_number asc`),
      query(`select id,item_code,description,unit_of_measure,standard_cost from materials where active=true order by description`)
    ]);

    const active = activeR.rows[0] || null;
    const activeJobId = active?.jobs?.id || null;
    const jobMaterialsR = activeJobId
      ? await query(
          `select m.id, m.item_code, m.description, m.unit_of_measure, m.standard_cost, jm.planned_quantity
           from job_materials jm join materials m on m.id=jm.material_id
           where jm.job_id=$1 and m.active=true
           order by m.description`, [activeJobId])
      : null;

    return NextResponse.json({
      employee: employeeR.rows[0] || null,
      active,
      openJobs: openJobsR.rows,
      materials: materialsR.rows,
      jobMaterials: jobMaterialsR ? jobMaterialsR.rows : []
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
