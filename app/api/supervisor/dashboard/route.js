import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const auth = await requireSession(['supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [activeR, operationsR, employeesR, departmentsR] = await Promise.all([
      query(`select te.id,te.started_at,
                    json_build_object('id',e.id,'full_name',e.full_name) as employees,
                    json_build_object('job_number',j.job_number,'description',j.description) as jobs,
                    json_build_object('id',o.id,'operation_name',o.operation_name,'departments',json_build_object('name',d.name)) as operations
             from time_entries te
             join employees e on e.id=te.employee_id
             left join jobs j on j.id=te.job_id
             left join operations o on o.id=te.operation_id
             left join departments d on d.id=o.department_id
             where te.stopped_at is null order by te.started_at`),
      query(`select o.id,o.operation_name,o.estimated_hours,o.status,o.planned_start,o.planned_finish,o.sequence_no,
                    json_build_object('id',j.id,'job_number',j.job_number,'description',j.description,'due_date',j.due_date,'priority',j.priority) as jobs,
                    json_build_object('id',d.id,'name',d.name) as departments,
                    coalesce((select json_agg(json_build_object('id',a.id,'employees',json_build_object('id',e.id,'full_name',e.full_name)) order by a.assigned_at)
                              from assignments a join employees e on e.id=a.employee_id where a.operation_id=o.id),'[]'::json) as assignments
             from operations o join jobs j on j.id=o.job_id join departments d on d.id=o.department_id
             where o.status <> 'complete'
             order by o.planned_start nulls last, j.priority asc, j.due_date nulls last`),
      query(`select e.id,e.full_name,e.employee_code,e.role,
                    case when d.id is null then null else json_build_object('id',d.id,'name',d.name) end as departments
             from employees e left join departments d on d.id=e.department_id where e.active=true order by e.full_name`),
      query(`select id,name from departments where active=true order by name`)
    ]);
    return NextResponse.json({ active: activeR.rows, operations: operationsR.rows, employees: employeesR.rows, departments: departmentsR.rows });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
