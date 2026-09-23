import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query, getDb } from '../../../../lib/db';
import { requireSession } from '../../../../lib/session';

async function requireAdmin() {
  return requireSession(['admin']);
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [employees, jobs, materials, timeEntries, materialTransactions, jobMaterials] = await Promise.all([
      query('select id,employee_code,full_name,role,active from employees order by full_name'),
      query('select id,job_number,customer_name,description,due_date,priority,status from jobs order by created_at desc'),
      query('select id,item_code,description,unit_of_measure,standard_cost,active from materials order by item_code'),
      query(`select te.id, te.job_id, te.employee_id, te.entry_type, te.started_at, te.stopped_at, te.notes, te.adjusted_by,
                    e.full_name as employee_name,
                    adj.full_name as adjusted_by_name,
                    j.job_number,
                    extract(epoch from (coalesce(te.stopped_at, now()) - te.started_at))/3600.0 as hours
             from time_entries te
             join employees e on e.id=te.employee_id
             left join employees adj on adj.id=te.adjusted_by
             left join jobs j on j.id=te.job_id
             order by te.started_at desc`),
      query(`select mt.id, mt.job_id, mt.material_id, mt.custom_material_name, mt.employee_id, mt.transaction_type, mt.quantity, mt.unit_cost, mt.occurred_at, mt.notes,
                    m.item_code, coalesce(m.description, mt.custom_material_name) as material_description, m.unit_of_measure,
                    e.full_name as employee_name,
                    j.job_number
             from material_transactions mt
             left join materials m on m.id=mt.material_id
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
    return NextResponse.json({ employees: employees.rows, jobs: jobs.rows, materials: materials.rows, timeEntries: timeEntries.rows, materialTransactions: materialTransactions.rows, jobMaterials: jobMaterials.rows });
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to load setup data.' }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { type } = body;
    if (type === 'resetAllData') {
      if (body.confirm !== 'RESET') throw new Error('Type RESET (all caps) to confirm — this permanently deletes every job, time entry, material transaction, and team member.');
      const keepId = auth.session.employeeId;
      const client = await getDb().connect();
      try {
        await client.query('begin');
        await client.query('delete from material_transactions');
        await client.query('delete from time_entries');
        await client.query('delete from job_materials');
        await client.query('delete from jobs');
        await client.query('delete from materials');
        await client.query('delete from employees where id<>$1', [keepId]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'employee') {
      const { id, employeeCode, fullName, role, pin, active } = body;
      if (!employeeCode?.trim() || !fullName?.trim() || (!id && (!pin || String(pin).length < 4))) throw new Error('Employee code, name, and a four-digit PIN are required for a new employee.');
      if (!['employee', 'admin'].includes(role)) throw new Error('Choose a valid role.');
      try {
        if (id) {
          if (pin && String(pin).length < 4) throw new Error('A replacement PIN must have at least four digits.');
          const isActive = active !== false;
          const values=[employeeCode.trim().toUpperCase(),fullName.trim(),role,isActive,id];
          let sql='update employees set employee_code=$1,full_name=$2,role=$3,active=$4';
          if (pin) { values.splice(4,0,await bcrypt.hash(String(pin),10)); sql+=',pin_hash=$5 where id=$6'; } else sql+=' where id=$5';
          await query(sql,values);
        } else {
          const hash = await bcrypt.hash(String(pin), 10);
          await query(`insert into employees(employee_code,full_name,role,pin_hash) values ($1,$2,$3,$4)`, [employeeCode.trim().toUpperCase(), fullName.trim(), role, hash]);
        }
      } catch (e) {
        if (e.code === '23505') throw new Error('An employee with that employee code already exists.');
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'employeeDelete') {
      const { id } = body;
      try {
        await query('delete from employees where id=$1', [id]);
        return NextResponse.json({ ok: true });
      } catch (e) {
        if (e.code === '23503') throw new Error('This team member has time entries or material transactions on record, so they can\'t be deleted — deactivate them instead to keep history intact.');
        throw e;
      }
    }
    if (type === 'job') {
      const { id, jobNumber, customerName, description, dueDate, priority, status } = body;
      if (!jobNumber?.trim() || !description?.trim()) throw new Error('Job number and description are required.');
      const validStatus = ['not_started','in_progress','on_hold','complete','closed'].includes(status) ? status : 'not_started';
      try {
        if(id) await query('update jobs set job_number=$1,customer_name=$2,description=$3,due_date=$4,priority=$5,status=$6 where id=$7',[jobNumber.trim().toUpperCase(),customerName?.trim()||null,description.trim(),dueDate||null,Number(priority)||3,validStatus,id]);
        else await query(`insert into jobs(job_number,customer_name,description,due_date,priority) values ($1,$2,$3,$4,$5)`, [jobNumber.trim().toUpperCase(), customerName?.trim() || null, description.trim(), dueDate || null, Number(priority) || 3]);
      } catch (e) {
        if (e.code === '23505') throw new Error('A job with that job number already exists.');
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'jobDelete') {
      const { id } = body;
      try {
        await query('delete from jobs where id=$1', [id]);
        return NextResponse.json({ ok: true });
      } catch (e) {
        if (e.code === '23503') throw new Error('This job has time entries or material transactions on record, so it can\'t be deleted — close it instead to keep history intact.');
        throw e;
      }
    }
    if (type === 'material') {
      const { id, itemCode, description, unitOfMeasure, standardCost, active } = body;
      if (!itemCode?.trim() || !description?.trim() || !unitOfMeasure?.trim()) throw new Error('Item code, description, and unit of measure are required.');
      try {
        if(id) await query('update materials set item_code=$1,description=$2,unit_of_measure=$3,standard_cost=$4,active=$5 where id=$6',[itemCode.trim().toUpperCase(),description.trim(),unitOfMeasure.trim(),standardCost===''?null:Number(standardCost),active!==false,id]);
        else await query(`insert into materials(item_code,description,unit_of_measure,standard_cost) values ($1,$2,$3,$4)`, [itemCode.trim().toUpperCase(), description.trim(), unitOfMeasure.trim(), standardCost === '' ? null : Number(standardCost)]);
      } catch (e) {
        if (e.code === '23505') throw new Error('A material with that item code already exists.');
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    if (type === 'materialDelete') {
      const { id } = body;
      try {
        await query('delete from materials where id=$1', [id]);
        return NextResponse.json({ ok: true });
      } catch (e) {
        if (e.code === '23503') throw new Error('This material has transactions or planned job usage on record, so it can\'t be deleted — deactivate it instead to keep history intact.');
        throw e;
      }
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
      const { id, employeeId, jobId, entryType, startedAt, stoppedAt, notes } = body;
      if (!employeeId || !entryType || !startedAt) throw new Error('Employee, type, and a start time are required.');
      if (!['direct', 'indirect', 'break', 'training', 'pto', 'holiday'].includes(entryType)) throw new Error('Choose a valid time type.');
      if (stoppedAt && new Date(stoppedAt) < new Date(startedAt)) throw new Error('Stop time must be on or after the start time.');
      try {
        if (id) await query(
          `update time_entries set employee_id=$1,job_id=$2,entry_type=$3,started_at=$4,stopped_at=$5,notes=$6,adjusted_by=$7 where id=$8`,
          [employeeId, jobId || null, entryType, startedAt, stoppedAt || null, notes?.trim() || null, auth.session.employeeId, id]
        );
        else await query(
          `insert into time_entries(employee_id,job_id,entry_type,started_at,stopped_at,notes,adjusted_by)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [employeeId, jobId || null, entryType, startedAt, stoppedAt || null, notes?.trim() || null, auth.session.employeeId]
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
      const { id, jobId, materialId, employeeId, transactionType, quantity, unitCost, occurredAt, notes } = body;
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
        `update material_transactions set job_id=$1,material_id=$2,employee_id=$3,transaction_type=$4,quantity=$5,unit_cost=$6,occurred_at=$7,notes=$8 where id=$9`,
        [jobId, materialId, employeeId, transactionType, qty, cost, occurred, notes?.trim() || null, id]
      );
      else await query(
        `insert into material_transactions(job_id,material_id,employee_id,transaction_type,quantity,unit_cost,occurred_at,notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [jobId, materialId, employeeId, transactionType, qty, cost, occurred, notes?.trim() || null]
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
    throw new Error('Unknown setup item.');
  } catch (e) { return NextResponse.json({ error: e.message || 'Unable to save setup data.' }, { status: 400 }); }
}
