'use client';
import '../globals.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
  const router=useRouter();
  const [employeeCode,setEmployeeCode]=useState(''); const [pin,setPin]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e){ e.preventDefault(); setBusy(true); setError('');
    try{ const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employeeCode,pin})}); const data=await res.json(); if(!res.ok) throw new Error(data.error||'Login failed'); router.push(data.user.role==='employee'?'/employee':'/supervisor'); router.refresh(); }
    catch(err){setError(err.message);} finally{setBusy(false);} }
  return <main className="shell"><div className="topbar"><div className="brand">MASTERCRAFT</div></div><div className="container narrow">
    <div className="card login-card"><div className="kicker">Shop Management</div><h1>Sign in</h1><p className="muted">Use your employee code and PIN.</p>
      <form onSubmit={submit}><div className="field"><label>Employee Code</label><input autoCapitalize="characters" autoComplete="username" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)} placeholder="E1001" /></div>
      <div className="field"><label>PIN</label><input inputMode="numeric" autoComplete="current-password" type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" /></div>
      {error&&<div className="alert error">{error}</div>}<button disabled={busy} className="btn primary">{busy?'SIGNING IN...':'SIGN IN'}</button></form>
    </div></div></main>
}
