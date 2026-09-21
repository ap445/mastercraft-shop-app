import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const auth = await requireSession(['employee', 'supervisor', 'admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const employeeId = auth.session.employeeId;

    const [employeeR, activeR, assignmentsR, materialsR, guidanceR] = await Promise.all([
      query(`select e.id,e.employee_code,e.full_name,e.role,
                    case when d.id is null then null else json_build_object('name',d.name) end as departments
             from employees e left join departments d on d.id=e.department_id where e.id=$1`, [employeeId]),
      query(`select te.id,te.started_at,te.entry_type,
                    json_build_object('id',j.id,'job_number',j.job_number,'description',j.description) as jobs,
                    case when o.id is null then null else json_build_object('id',o.id,'operation_name',o.operation_name) end as operations
             from time_entries te
             left join jobs j on j.id=te.job_id
             left join operations o on o.id=te.operation_id
             where te.employee_id=$1 and te.stopped_at is null limit 1`, [employeeId]),
      query(`select a.id,
                    json_build_object(
                      'id',o.id,'operation_name',o.operation_name,'estimated_hours',o.estimated_hours,
                      'status',o.status,'planned_start',o.planned_start,
                      'jobs',json_build_object('id',j.id,'job_number',j.job_number,'description',j.description,'due_date',j.due_date,'priority',j.priority),
                      'departments',json_build_object('name',d.name)
                    ) as operations
             from assignments a
             join operations o on o.id=a.operation_id
             join jobs j on j.id=o.job_id
             join departments d on d.id=o.department_id
             where a.employee_id=$1 and o.status <> 'complete'
             order by a.assigned_at asc`, [employeeId]),
      query(`select id,item_code,description,unit_of_measure,standard_cost from materials where active=true order by description`),
      query(`select g.id,g.scope_type,g.title,g.instructions,g.daily_goal,g.guidance_date,d.name as department_name,j.job_number,
                    coalesce((select json_agg(json_build_object('id',ga.id,'filename',ga.filename,'file_size',ga.file_size) order by ga.uploaded_at)
                              from guidance_attachments ga where ga.guidance_id=g.id),'[]'::json) as attachments
             from daily_guidance g
             left join employees e on e.id=$1
             left join departments d on d.id=g.department_id
             left join jobs j on j.id=g.job_id
             where g.active=true and (
               (g.scope_type='role' and g.role=e.role) or
               (g.scope_type='department' and g.department_id=e.department_id) or
               (g.scope_type='job' and g.department_id=e.department_id
                 and (g.guidance_date=current_date or g.guidance_date is null)
                 and not (g.guidance_date is null and exists(
                   select 1 from daily_guidance g2 where g2.scope_type='job' and g2.job_id=g.job_id and g2.department_id=g.department_id and g2.guidance_date=current_date
                 ))
                 and exists(
                   select 1 from operations o where o.job_id=g.job_id and o.department_id=g.department_id and o.status<>'complete'
                 ))
             )
             order by g.scope_type`, [employeeId])
    ]);

    return NextResponse.json({
      employee: employeeR.rows[0] || null,
      active: activeR.rows[0] || null,
      assignments: assignmentsR.rows,
      materials: materialsR.rows,
      guidance: guidanceR.rows
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
