import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { requireSession } from '../../../../lib/session';

async function requireAdmin() {
  return requireSession(['admin']);
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [departments, employees, jobs, materials, guidance, operations, timeEntries, materialTransactions, jobMaterials] = await Promise.all([
      query('select id,name,active from departments order by name'),
      query(`select e.id,e.employee_code,e.full_name,e.department_id,e.role,e.active,d.name as department_name
             from employees e left join departments d on d.id=e.department_id order by e.full_name`),
      query('select id,job_number,customer_name,description,due_date,priority,status from jobs order by created_at desc'),
      query('select id,item_code,description,unit_of_measure,standard_cost,active from materials order by item_code'),
      query(`select g.id,g.scope_type,g.role,g.department_id,g.job_id,g.guidance_date,g.title,g.instructions,g.daily_goal,d.name as department_name,j.job_number,
                    coalesce((select json_agg(json_build_object('id',ga.id,'filename',ga.filename,'content_type',ga.content_type,'file_size',ga.file_size,'uploaded_at',ga.uploaded_at) order by ga.uploaded_at)
                              from guidance_attachments ga where ga.guidance_id=g.id),'[]'::json) as attachments
             from daily_guidance g left join departments d on d.id=g.department_id left join jobs j on j.id=g.job_id
             where g.active=true order by g.scope_type,coalesce(j.job_number,''),coalesce(d.name,''),g.guidance_date nulls first,g.title`),
      query(`select o.id,o.job_id,o.department_id,o.operation_name,o.sequence_no,o.estimated_hours,o.planned_start,o.planned_finish,o.status,
                    j.job_number,j.description as job_description,d.name as department_name,
                    coalesce((select json_agg(json_build_object('employee_id',e.id,'full_name',e.full_name) order by e.full_name)
                              from assignments a join employees e on e.id=a.employee_id where a.operation_id=o.id),'[]'::json) as assigned
             from operations o join jobs j on j.id=o.job_id join departments d on d.id=o.department_id
             order by j.job_number,o.sequence_no`),
      query(`select te.id, te.job_id, te.operation_id, te.employee_id, te.entry_type, te.started_at, te.stopped_at, te.notes, te.adjusted_by,
                    e.full_name as employee_name,
                    adj.full_name as adjusted_by_name,
                    o.operation_name, o.sequence_no,
                    j.job_number,
                    extract(epoch from (coalesce(te.stopped_at, now()) - te.started_at))/3600.0 as hours
             from time_entries te
             join employees e on e.id=te.employee_id
             left join employees adj on adj.id=te.adjusted_by
             left join operations o on o.id=te.operation_id
             left join jobs j on j.id=te.job_id
             order by te.started_at desc`),
      query(`select mt.id, mt.job_id, mt.operation_id, mt.material_id, mt.employee_id, mt.transaction_type, mt.quantity, mt.unit_cost, mt.occurred_at, mt.notes,
                    m.item_code, m.description as material_description, m.unit_of_measure,
                    e.full_name as employee_name,
                    j.job_number
             from material_transactions mt
             join materials m on m.id=mt.material_id
             join employees e on e.id=mt.employee_id
             left join jobs j on j.id=mt.job_id
             order by mt.occurred_at desc`),
      query(`select jm.id, jm.job_id, jm.material_id, jm.planned_quantity, jm.notes,
                    j.job_number,
                    m.item_code, m.description as material_description, m.unit_of_measure, m.standard_cost
             from job_materials jm
             join jobs j on j.id=jm.job_id
             join materials m on m.id=jm.material_id
             order by j.job_number, m.item_code`)
    ]);
    return NextResponse.json({ departments: departments.rows, employees: employees.rows, jobs: jobs.rows, materials: materials.rows, guidance: guidance.rows, operations: operations.rows, timeEntries: timeEntries.rows, materialTransactions: materialTransactions.rows, jobMaterials: jobMaterials.rows });
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to load setup data.' }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { type } = body;
    if (type === 'department') {
      if (!body.name?.trim()) throw new Error('Department name is required.');
      const result = await query('insert into departments(name) values ($1) returning id,name,active', [body.name.trim()]);
      return NextResponse.json({ item: result.rows[0] });
    }
    if (type === 'employee') {
      const { id, employeeCode, fullName, departmentId, role, pin, active } = body;
      if (!employeeCode?.trim() || !fullName?.trim() || (!id && (!pin || String(pin).length < 4))) throw new Error('Employee code, name, and a four-digit PIN are required for a new employee.');
      if (!['employee', 'supervisor', 'admin'].includes(role)) throw new Error('Choose a valid role.');
      if (id) {
        if (pin && String(pin).length < 4) throw new Error('A replacement PIN must have at least four digits.');
        const isActive = active !== false;
        const values=[employeeCode.trim().toUpperCase(),fullName.trim(),departmentId||null,role,isActive,id];
        let sql='update employees set employee_code=$1,full_name=$2,department_id=$3,role=$4,active=$5';
        if (pin) { values.splice(5,0,await bcrypt.hash(String(pin),10)); sql+=',pin_hash=$6 where id=$7'; } else sql+=' where id=$6';
        await query(sql,values);
      } else {
        const hash = await bcrypt.hash(String(pin), 10);
        await query(`insert into employees(employee_code,full_name,department_id,role,pin_hash) values ($1,$2,$3,$4,$5)`, [employeeCode.trim().toUpperCase(), fullName.trim(), departmentId || null, role, hash]);
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'job') {
      const { id, jobNumber, customerName, description, dueDate, priority, status } = body;
      if (!jobNumber?.trim() || !description?.trim()) throw new Error('Job number and description are required.');
      const validStatus = ['not_started','in_progress','on_hold','complete','closed'].includes(status) ? status : 'not_started';
      if(id) await query('update jobs set job_number=$1,customer_name=$2,description=$3,due_date=$4,priority=$5,status=$6 where id=$7',[jobNumber.trim().toUpperCase(),customerName?.trim()||null,description.trim(),dueDate||null,Number(priority)||3,validStatus,id]);
      else await query(`insert into jobs(job_number,customer_name,description,due_date,priority) values ($1,$2,$3,$4,$5)`, [jobNumber.trim().toUpperCase(), customerName?.trim() || null, description.trim(), dueDate || null, Number(priority) || 3]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'material') {
      const { id, itemCode, description, unitOfMeasure, standardCost, active } = body;
      if (!itemCode?.trim() || !description?.trim() || !unitOfMeasure?.trim()) throw new Error('Item code, description, and unit of measure are required.');
      if(id) await query('update materials set item_code=$1,description=$2,unit_of_measure=$3,standard_cost=$4,active=$5 where id=$6',[itemCode.trim().toUpperCase(),description.trim(),unitOfMeasure.trim(),standardCost===''?null:Number(standardCost),active!==false,id]);
      else await query(`insert into materials(item_code,description,unit_of_measure,standard_cost) values ($1,$2,$3,$4)`, [itemCode.trim().toUpperCase(), description.trim(), unitOfMeasure.trim(), standardCost === '' ? null : Number(standardCost)]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'operation') {
      const { id, jobId, departmentId, operationName, sequenceNo, estimatedHours, plannedStart, plannedFinish, status } = body;
      if (!jobId || !departmentId || !operationName?.trim()) throw new Error('Job, department, and operation name are required.');
      const seq = Number(sequenceNo) || 1;
      const hours = estimatedHours === '' || estimatedHours == null ? null : Number(estimatedHours);
      const validStatus = ['queued','ready','in_progress','paused','blocked','complete'].includes(status) ? status : 'queued';
      try {
        if (id) await query(
          `update operations set job_id=$1,department_id=$2,operation_name=$3,sequence_no=$4,estimated_hours=$5,planned_start=$6,planned_finish=$7,status=$8 where id=$9`,
          [jobId, departmentId, operationName.trim(), seq, hours, plannedStart || null, plannedFinish || null, validStatus, id]
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
    if (type === 'jobMaterial') {
      const { jobId, materialId, plannedQuantity, notes } = body;
      const qty = Number(plannedQuantity);
      if (!jobId || !materialId || !qty || qty <= 0) throw new Error('Job, material, and a positive planned quantity are required.');
      await query(
        `insert into job_materials(job_id,material_id,planned_quantity,notes) values ($1,$2,$3,$4)
         on conflict (job_id,material_id) do update set planned_quantity=excluded.planned_quantity,notes=excluded.notes`,
        [jobId, materialId, qty, notes?.trim() || null]
      );
      return NextResponse.json({ ok: true });
    }
    if (type === 'jobMaterialDelete') {
      const { id } = body;
      if (!id) throw new Error('Missing record to remove.');
      await query('delete from job_materials where id=$1', [id]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'timeEntry') {
      const { id, employeeId, jobId, operationId, entryType, startedAt, stoppedAt, notes } = body;
      if (!employeeId || !entryType || !startedAt) throw new Error('Employee, type, and a start time are required.');
      if (!['direct', 'indirect', 'break', 'training', 'pto', 'holiday'].includes(entryType)) throw new Error('Choose a valid time type.');
      if (stoppedAt && new Date(stoppedAt) < new Date(startedAt)) throw new Error('Stop time must be on or after the start time.');
      try {
        if (id) await query(
          `update time_entries set employee_id=$1,job_id=$2,operation_id=$3,entry_type=$4,started_at=$5,stopped_at=$6,notes=$7,adjusted_by=$8 where id=$9`,
          [employeeId, jobId || null, operationId || null, entryType, startedAt, stoppedAt || null, notes?.trim() || null, auth.session.employeeId, id]
        );
        else await query(
          `insert into time_entries(employee_id,job_id,operation_id,entry_type,started_at,stopped_at,notes,adjusted_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [employeeId, jobId || null, operationId || null, entryType, startedAt, stoppedAt || null, notes?.trim() || null, auth.session.employeeId]
        );
      } catch (e) {
        if (e.code === '23505') throw new Error('This employee already has an open time entry. Set a stop time here, or close the other entry first.');
        if (e.code === '23514') throw new Error('Stop time must be on or after the start time.');
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'timeEntryDelete') {
      const { id } = body;
      if (!id) throw new Error('Missing record to remove.');
      await query('delete from time_entries where id=$1', [id]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'materialTransaction') {
      const { id, jobId, operationId, materialId, employeeId, transactionType, quantity, unitCost, occurredAt, notes } = body;
      const qty = Number(quantity);
      if (!jobId || !materialId || !employeeId || !qty || qty <= 0) throw new Error('Job, material, employee, and a positive quantity are required.');
      if (!['issue', 'return'].includes(transactionType)) throw new Error('Choose issue or return.');
      let cost = unitCost === '' || unitCost == null ? null : Number(unitCost);
      if (cost == null) {
        const matR = await query('select standard_cost from materials where id=$1', [materialId]);
        cost = matR.rows[0]?.standard_cost ?? null;
      }
      const occurred = occurredAt || new Date().toISOString();
      if (id) await query(
        `update material_transactions set job_id=$1,operation_id=$2,material_id=$3,employee_id=$4,transaction_type=$5,quantity=$6,unit_cost=$7,occurred_at=$8,notes=$9 where id=$10`,
        [jobId, operationId || null, materialId, employeeId, transactionType, qty, cost, occurred, notes?.trim() || null, id]
      );
      else await query(
        `insert into material_transactions(job_id,operation_id,material_id,employee_id,transaction_type,quantity,unit_cost,occurred_at,notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [jobId, operationId || null, materialId, employeeId, transactionType, qty, cost, occurred, notes?.trim() || null]
      );
      return NextResponse.json({ ok: true });
    }
    if (type === 'materialTransactionDelete') {
      const { id } = body;
      if (!id) throw new Error('Missing record to remove.');
      await query('delete from material_transactions where id=$1', [id]);
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
      const { id, scopeType, role, departmentId, jobId, title, instructions, dailyGoal, guidanceDate } = body;
      if (!['role','department','job'].includes(scopeType) || !title?.trim()) throw new Error('Choose a scope and provide a title.');
      if (scopeType === 'role' && !['employee','supervisor','admin'].includes(role)) throw new Error('Choose a valid role.');
      if (scopeType === 'department' && !departmentId) throw new Error('Choose a department.');
      if (scopeType === 'job' && (!jobId || !departmentId)) throw new Error('Choose a job and a department.');
      const dateVal = scopeType === 'job' && guidanceDate ? guidanceDate : null;
      let resultId = id;
      try {
        if (id) {
          await query(`update daily_guidance set scope_type=$1,role=$2,department_id=$3,job_id=$4,title=$5,instructions=$6,daily_goal=$7,guidance_date=$8,active=true where id=$9`,
            [scopeType, scopeType==='role'?role:null, scopeType==='role'?null:departmentId, scopeType==='job'?jobId:null, title.trim(), instructions?.trim()||null, dailyGoal?.trim()||null, dateVal, id]);
        } else if (scopeType === 'role') {
          const r = await query(`insert into daily_guidance(scope_type,role,department_id,job_id,title,instructions,daily_goal)
                       values ('role',$1,null,null,$2,$3,$4)
                       on conflict (role) where scope_type='role' do update set title=excluded.title,instructions=excluded.instructions,daily_goal=excluded.daily_goal,active=true
                       returning id`,
            [role, title.trim(), instructions?.trim() || null, dailyGoal?.trim() || null]);
          resultId = r.rows[0]?.id;
        } else if (scopeType === 'department') {
          const r = await query(`insert into daily_guidance(scope_type,role,department_id,job_id,title,instructions,daily_goal)
                       values ('department',null,$1,null,$2,$3,$4)
                       on conflict (department_id) where scope_type='department' do update set title=excluded.title,instructions=excluded.instructions,daily_goal=excluded.daily_goal,active=true
                       returning id`,
            [departmentId, title.trim(), instructions?.trim() || null, dailyGoal?.trim() || null]);
          resultId = r.rows[0]?.id;
        } else {
          const conflictTarget = dateVal
            ? `(job_id,department_id,guidance_date) where scope_type='job' and guidance_date is not null`
            : `(job_id,department_id) where scope_type='job' and guidance_date is null`;
          const r = await query(`insert into daily_guidance(scope_type,role,department_id,job_id,title,instructions,daily_goal,guidance_date)
                       values ('job',null,$1,$2,$3,$4,$5,$6)
                       on conflict ${conflictTarget} do update set title=excluded.title,instructions=excluded.instructions,daily_goal=excluded.daily_goal,active=true
                       returning id`,
            [departmentId, jobId, title.trim(), instructions?.trim() || null, dailyGoal?.trim() || null, dateVal]);
          resultId = r.rows[0]?.id;
        }
      } catch (e) {
        if (e.code === '23505') throw new Error(dateVal ? 'An expectation for this job, department, and date already exists — edit that one instead.' : 'A general expectation for this job and department already exists — edit that one, or pick a specific date.');
        throw e;
      }
      return NextResponse.json({ ok: true, id: resultId });
    }
    if (type === 'guidanceDelete') {
      const { id } = body;
      if (!id) throw new Error('Missing expectation to remove.');
      await query('delete from daily_guidance where id=$1', [id]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'guidanceAttachmentDelete') {
      const { id } = body;
      if (!id) throw new Error('Missing attachment to remove.');
      await query('delete from guidance_attachments where id=$1', [id]);
      return NextResponse.json({ ok: true });
    }
    throw new Error('Unknown setup item.');
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to save setup data.' }, { status: 400 }); }
}
