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
    const [departments, employees, jobs, materials, guidance] = await Promise.all([
      query('select id,name,active from departments order by name'),
      query(`select e.id,e.employee_code,e.full_name,e.role,e.active,d.name as department_name
             from employees e left join departments d on d.id=e.department_id order by e.full_name`),
      query('select id,job_number,customer_name,description,due_date,priority,status from jobs order by created_at desc'),
      query('select id,item_code,description,unit_of_measure,standard_cost,active from materials order by item_code'),
      query(`select g.id,g.scope_type,g.role,g.title,g.instructions,g.daily_goal,d.name as department_name
             from daily_guidance g left join departments d on d.id=g.department_id where g.active=true order by g.scope_type,g.title`)
    ]);
    return NextResponse.json({ departments: departments.rows, employees: employees.rows, jobs: jobs.rows, materials: materials.rows, guidance: guidance.rows });
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
      const { employeeCode, fullName, departmentId, role, pin } = body;
      if (!employeeCode?.trim() || !fullName?.trim() || !pin || String(pin).length < 4) throw new Error('Employee code, name, and a four-digit PIN are required.');
      if (!['employee', 'supervisor', 'admin'].includes(role)) throw new Error('Choose a valid role.');
      const hash = await bcrypt.hash(String(pin), 10);
      await query(`insert into employees(employee_code,full_name,department_id,role,pin_hash)
                   values ($1,$2,$3,$4,$5)`, [employeeCode.trim().toUpperCase(), fullName.trim(), departmentId || null, role, hash]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'job') {
      const { jobNumber, customerName, description, dueDate, priority } = body;
      if (!jobNumber?.trim() || !description?.trim()) throw new Error('Job number and description are required.');
      await query(`insert into jobs(job_number,customer_name,description,due_date,priority)
                   values ($1,$2,$3,$4,$5)`, [jobNumber.trim().toUpperCase(), customerName?.trim() || null, description.trim(), dueDate || null, Number(priority) || 3]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'material') {
      const { itemCode, description, unitOfMeasure, standardCost } = body;
      if (!itemCode?.trim() || !description?.trim() || !unitOfMeasure?.trim()) throw new Error('Item code, description, and unit of measure are required.');
      await query(`insert into materials(item_code,description,unit_of_measure,standard_cost)
                   values ($1,$2,$3,$4)`, [itemCode.trim().toUpperCase(), description.trim(), unitOfMeasure.trim(), standardCost === '' ? null : Number(standardCost)]);
      return NextResponse.json({ ok: true });
    }
    if (type === 'guidance') {
      const { scopeType, role, departmentId, title, instructions, dailyGoal } = body;
      if (!['role','department'].includes(scopeType) || !title?.trim()) throw new Error('Choose a scope and provide a title.');
      if (scopeType === 'role' && !['employee','supervisor','admin'].includes(role)) throw new Error('Choose a valid role.');
      if (scopeType === 'department' && !departmentId) throw new Error('Choose a department.');
      if (scopeType === 'role') await query(`insert into daily_guidance(scope_type,role,department_id,title,instructions,daily_goal)
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
