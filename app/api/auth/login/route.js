import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { setSession } from '../../../../lib/session';

export async function POST(request) {
  try {
    const { employeeCode, pin } = await request.json();
    if (!employeeCode || !pin) return NextResponse.json({ error: 'Employee code and PIN are required.' }, { status: 400 });
    const result = await query(
      `select id, employee_code, full_name, role, pin_hash, active
       from employees where upper(employee_code)=upper($1) limit 1`,
      [String(employeeCode).trim()]
    );
    const employee = result.rows[0];
    if (!employee || !employee.active || !employee.pin_hash || !(await bcrypt.compare(String(pin), employee.pin_hash))) {
      return NextResponse.json({ error: 'Invalid employee code or PIN.' }, { status: 401 });
    }
    await setSession(employee);
    return NextResponse.json({ user: { id: employee.id, name: employee.full_name, role: employee.role } });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Login failed.' }, { status: 500 });
  }
}
