import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { requireSession } from '../../../../lib/session';

async function requireAdmin() {
  const auth = await requireSession(['admin']);
  if (auth.error) return auth;
  return null;
}

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
    const [departments, employees, jobs, materials, guidance, operations] = await Promise.all([
      query('select id,name,active from departments order by name'),
      query(`select e.id,e.employee_code,e.full_name,e.department_id,e.role,e.active,d.name as department_name
             from employees e left join departments d on d.id=e.department_id order by e.full_name`),
      query('select id,job_number,customer_name,description,due_date,priority,status from jobs order by created_at desc'),
      query('select id,item_code,description,unit_of_measure,standard_cost,active from materials order by item_code'),
      query(`select g.id,g.scope_type,g.role,g.department_id,g.title,g.instructions,g.daily_goal,d.name as department_name
             from daily_guidance g left join departments d on d.id=g.department_id where g.active=true order by g.scope_type,g.title`),
      query(`select o.id,o.job_id,o.department_id,o.operation_name,o.sequence_no,o.estimated_hours,o.planned_start,o.planned_finish,o.status,
                    j.job_number,j.description as job_description,d.name as department_name
             from operations o join jobs j on j.id=o.job_id join departments d on d.id=o.department_id
             order by j.job_number,o.sequence_no`)
    ]);
    return NextResponse.json({ departments: departments.rows, employees: employees.rows, jobs: jobs.rows, materials: materials.rows, guidance: guidance.rows, operations: operations.rows });
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to load setup data.' }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const denied = await requireAdmin();
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
    const body = await request.json();
    const { type } = body;
    if (type === 'department') {
      if (!body.name?.trim()) throw new Error('Department name is required.');
      const result = await query('insert into departments(name) values ($1) returning id,name,active', [body.name.trim()]);
      return NextResponse.json({ item: result.rows[0] });
    }
    if (type === 'employee') {
      const { id, employeeCode, fullName, departmentId, role, pin } = body;
      if (!employeeCode?.trim() || !fullName?.trim() || (!id && (!pin || String(pin).length < 4))) throw new Error('Employee code, name, and a four-digit PIN are required for a new employee.');
      if (!['employee', 'supervisor', 'admin'].includes(role)) throw new Error('Choose a valid role.');
      if (id) {
        if (pin && String(pin).length < 4) throw new Error('A replacement PIN must have at least four digits.');
        const values=[employeeCode.trim().toUpperCase(),fullName.trim(),departmentId||null,role,id];
        let sql='update employees set employee_code=$1,full_name=$2,department_id=$3,role=$4';
        if (pin) { values.splice(4,0,await bcrypt.hash(String(pin),10)); sql+=',pin_hash=$5 where id=$6'; } else sql+=' where id=$5';
        await query(sql,values);
      } else {
        const hash = await bcrypt.hash(String(pin), 10);
        await query(`insert into employees(employee_code,full_name,department_id,role,pin_hash) values ($1,$2,$3,$4,$5)`, [employeeCode.trim().toUpperCase(), fullName.trim(), departmentId || null, role, hash]);
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'job') {
      const { id, jobNumber, customerName, description, dueDate, priority } = body;
      if (!jobNumber?.trim() || !description?.trim()) throw new Error('Job number and description are required.');
      if(id) await query('update jobs set job_number=$1,customer_name=$2,description=$3,due_date=$4,priority=$5 where id=$6',[jobNumber.trim().toUpperCase(),customerName?.trim()||null,description.trim(),dueDate||null,Number(priority)||3,id]);
      else await query(`insert into jobs(job_number,customer_name,description,due_date,priority) values ($1,$2,$3,$4,$5)`, [jobNumber.trim().toUpperCase(), customerName?.trim() || null, description.trim(), dueDate || null, Number(priority) || 3]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'material') {
      const { id, itemCode, description, unitOfMeasure, standardCost } = body;
      if (!itemCode?.trim() || !description?.trim() || !unitOfMeasure?.trim()) throw new Error('Item code, description, and unit of measure are required.');
      if(id) await query('update materials set item_code=$1,description=$2,unit_of_measure=$3,standard_cost=$4 where id=$5',[itemCode.trim().toUpperCase(),description.trim(),unitOfMeasure.trim(),standardCost===''?null:Number(standardCost),id]);
      else await query(`insert into materials(item_code,description,unit_of_measure,standard_cost) values ($1,$2,$3,$4)`, [itemCode.trim().toUpperCase(), description.trim(), unitOfMeasure.trim(), standardCost === '' ? null : Number(standardCost)]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'operation') {
      const { id, jobId, departmentId, operationName, sequenceNo, estimatedHours, plannedStart, plannedFinish } = body;
      if (!jobId || !departmentId || !operationName?.trim()) throw new Error('Job, department, and operation name are required.');
      const seq = Number(sequenceNo) || 1;
      const hours = estimatedHours === '' || estimatedHours == null ? null : Number(estimatedHours);
      try {
        if (id) await query(
          `update operations set job_id=$1,department_id=$2,operation_name=$3,sequence_no=$4,estimated_hours=$5,planned_start=$6,planned_finish=$7 where id=$8`,
          [jobId, departmentId, operationName.trim(), seq, hours, plannedStart || null, plannedFinish || null, id]
        );
        else await query(
          `insert into operations(job_id,department_id,operation_name,sequence_no,estimated_hours,planned_start,planned_finish)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [jobId, departmentId, operationName.trim(), seq, hours, plannedStart || null, plannedFinish || null]
        );
      } catch (e) {
        if (e.code === '23505') throw new Error(`This job already has an operation with sequence #${seq}. Choose a different sequence number.`);
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'materialsImport') {
      if (!Array.isArray(body.materials) || body.materials.length === 0) throw new Error('Choose a CSV file with at least one material.');
      if (body.materials.length > 1000) throw new Error('Import up to 1,000 materials at a time.');
      let imported = 0;
      const skipped = [];
      for (const [index, material] of body.materials.entries()) {
        const itemCode = String(material.itemCode || '').trim().toUpperCase();
        const description = String(material.description || '').trim();
        const unitOfMeasure = String(material.unitOfMeasure || '').trim();
        const rawCost = String(material.standardCost ?? '').trim();
        const standardCost = rawCost === '' ? null : Number(rawCost);
        if (!itemCode || !description || !unitOfMeasure || (rawCost !== '' && !Number.isFinite(standardCost))) {
          skipped.push(index + 2);
          continue;
        }
        await query(`insert into materials(item_code,description,unit_of_measure,standard_cost)
                     values ($1,$2,$3,$4)
                     on conflict (item_code) do update set description=excluded.description,
                       unit_of_measure=excluded.unit_of_measure,standard_cost=excluded.standard_cost,active=true`,
          [itemCode, description, unitOfMeasure, standardCost]);
        imported += 1;
      }
      return NextResponse.json({ imported, skipped });
    }
    if (type === 'guidance') {
      const { id, scopeType, role, departmentId, title, instructions, dailyGoal } = body;
      if (!['role','department'].includes(scopeType) || !title?.trim()) throw new Error('Choose a scope and provide a title.');
      if (scopeType === 'role' && !['employee','supervisor','admin'].includes(role)) throw new Error('Choose a valid role.');
      if (scopeType === 'department' && !departmentId) throw new Error('Choose a department.');
      if (id) await query(`update daily_guidance set scope_type=$1,role=$2,department_id=$3,title=$4,instructions=$5,daily_goal=$6,active=true where id=$7`,[scopeType,scopeType==='role'?role:null,scopeType==='department'?departmentId:null,title.trim(),instructions?.trim()||null,dailyGoal?.trim()||null,id]);
      else if (scopeType === 'role') await query(`insert into daily_guidance(scope_type,role,department_id,title,instructions,daily_goal)
                   values ('role',$1,null,$2,$3,$4)
                   on conflict (role) where scope_type='role' do update set title=excluded.title,instructions=excluded.instructions,daily_goal=excluded.daily_goal,active=true`,
        [role, title.trim(), instructions?.trim() || null, dailyGoal?.trim() || null]);
      else await query(`insert into daily_guidance(scope_type,role,department_id,title,instructions,daily_goal)
                   values ('department',null,$1,$2,$3,$4)
                   on conflict (department_id) where scope_type='department' do update set title=excluded.title,instructions=excluded.instructions,daily_goal=excluded.daily_goal,active=true`,
        [departmentId, title.trim(), instructions?.trim() || null, dailyGoal?.trim() || null]);
      return NextResponse.json({ ok: true });
    }
    throw new Error('Unknown setup item.');
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to save setup data.' }, { status: 400 }); }
}
