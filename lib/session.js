import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'mc_session';

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('APP_SESSION_SECRET must be at least 32 characters.');
  return value;
}

function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function sign(payload) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }

export async function setSession(employee) {
  const payload = encode({
    employeeId: employee.id,
    employeeCode: employee.employee_code,
    name: employee.full_name,
    role: employee.role,
    exp: Date.now() + 12 * 60 * 60 * 1000
  });
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 60 * 60
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function getSession() {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch { return null; }
}

export async function requireSession(roles = []) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  if (roles.length && !roles.includes(session.role)) return { error: 'Forbidden', status: 403 };
  return { session };
}
