import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/session';
import { query } from '../../../../lib/db';

export async function GET() {
  try {
    const auth = await requireSession(['supervisor','admin']);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [activeR, operationsR, employeesR, departmentsR, jobsR, allOperationsR, materialsR, guidanceR, timeEntriesR, materialTransactionsR, jobMaterialsR] = await Promise.all([
      query(`select te.id,te.started_at,
                    json_build_object('id',e.id,'full_name',e.full_name) as employees,
                    json_build_object('id',j.id,'job_number',j.job_number,'description',j.description) as jobs,
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
      query(`select id,name from departments where active=true order by name`),
      query('select id,job_number,customer_name,description,due_date,priority,status from jobs order by created_at desc'),
      query(`select o.id,o.job_id,o.department_id,o.operation_name,o.sequence_no,o.estimated_hours,o.planned_start,o.planned_finish,o.status,
                    j.job_number,j.description as job_description,d.name as department_name,
                    coalesce((select json_agg(json_build_object('employee_id',e.id,'full_name',e.full_name) order by e.full_name)
                              from assignments a join employees e on e.id=a.employee_id where a.operation_id=o.id),'[]'::json) as assigned
             from operations o join jobs j on j.id=o.job_id join departments d on d.id=o.department_id
             order by j.job_number,o.sequence_no`),
      query('select id,item_code,description,unit_of_measure,active from materials order by item_code'),
      query(`select g.id,g.scope_type,g.role,g.department_id,g.job_id,g.title,g.instructions,g.daily_goal,d.name as department_name,j.job_number,
                    coalesce((select json_agg(json_build_object('id',ga.id,'filename',ga.filename,'file_size',ga.file_size) order by ga.uploaded_at)
                              from guidance_attachments ga where ga.guidance_id=g.id),'[]'::json) as attachments
             from daily_guidance g left join departments d on d.id=g.department_id left join jobs j on j.id=g.job_id
             where g.active=true order by g.scope_type,g.title`),
      query(`select te.id, te.job_id, te.operation_id, te.employee_id, te.entry_type, te.started_at, te.stopped_at, te.notes,
                    e.full_name as employee_name, o.operation_name, o.sequence_no, j.job_number,
                    extract(epoch from (coalesce(te.stopped_at, now()) - te.started_at))/3600.0 as hours
             from time_entries te
             join employees e on e.id=te.employee_id
             left join operations o on o.id=te.operation_id
             left join jobs j on j.id=te.job_id
             order by te.started_at desc`),
      query(`select mt.id, mt.job_id, mt.operation_id, mt.material_id, mt.employee_id, mt.transaction_type, mt.quantity, mt.occurred_at, mt.notes,
                    m.item_code, m.description as material_description, m.unit_of_measure,
                    e.full_name as employee_name, j.job_number
             from material_transactions mt
             join materials m on m.id=mt.material_id
             join employees e on e.id=mt.employee_id
             left join jobs j on j.id=mt.job_id
             order by mt.occurred_at desc`),
      query(`select jm.id, jm.job_id, jm.material_id, jm.planned_quantity, jm.notes,
                    j.job_number, m.item_code, m.description as material_description, m.unit_of_measure
             from job_materials jm join jobs j on j.id=jm.job_id join materials m on m.id=jm.material_id
             order by j.job_number, m.item_code`)
    ]);
    return NextResponse.json({
      active: activeR.rows, operations: operationsR.rows, employees: employeesR.rows, departments: departmentsR.rows,
      jobs: jobsR.rows, allOperations: allOperationsR.rows, materials: materialsR.rows, guidance: guidanceR.rows,
      timeEntries: timeEntriesR.rows, materialTransactions: materialTransactionsR.rows, jobMaterials: jobMaterialsR.rows
    });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
