'use client';
import { useEffect, useState } from 'react';

const VIEWS = [
  { role: 'admin', href: '/admin', label: 'Admin Setup' },
  { role: 'supervisor', href: '/supervisor', label: 'Supervisor Board' },
  { role: 'employee', href: '/employee', label: 'My Work' }
];
const CAN_SEE = { admin: ['admin', 'supervisor', 'employee'], supervisor: ['supervisor', 'employee'], employee: ['employee'] };

// Shows links to whichever of Admin / Supervisor / Employee views the signed-in
// person has access to, besides the one they're already on — so anyone with
// more than one role can move between them from any page.
export default function RoleNav({ current }) {
  const [role, setRole] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json?.user?.role) setRole(json.user.role); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!role) return null;
  const visible = CAN_SEE[role] || [];
  return VIEWS.filter(v => v.role !== current && visible.includes(v.role)).map(v => (
    <a key={v.role} className="navlink" href={v.href}>{v.label}</a>
  ));
}
