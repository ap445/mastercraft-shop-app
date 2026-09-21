'use client';
import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function InstallBanner(){
  const [dismissed,setDismissed]=useState(true);
  const [isIOS,setIsIOS]=useState(false);
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  useEffect(()=>{
    try{
      const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
      const wasDismissed=localStorage.getItem('mc-install-dismissed')==='1';
      if(!standalone&&!wasDismissed){setDismissed(false);setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent||''));}
    }catch{}
  },[]);
  useEffect(()=>{
    function onPrompt(e){e.preventDefault();setDeferredPrompt(e);}
    window.addEventListener('beforeinstallprompt',onPrompt);
    return ()=>window.removeEventListener('beforeinstallprompt',onPrompt);
  },[]);
  function dismiss(){try{localStorage.setItem('mc-install-dismissed','1');}catch{} setDismissed(true);}
  async function install(){if(!deferredPrompt)return;deferredPrompt.prompt();try{await deferredPrompt.userChoice;}catch{} setDeferredPrompt(null);dismiss();}
  if(dismissed)return null;
  if(!isIOS&&!deferredPrompt)return null;
  return <div className="card install-banner">
    <button type="button" className="install-close" onClick={dismiss} aria-label="Dismiss">×</button>
    {isIOS?<>
      <strong>Add this to your Home Screen</strong>
      <p className="muted">In Safari, tap the Share button, then choose "Add to Home Screen." It'll open full-screen from an icon, like any other app.</p>
    </>:<>
      <strong>Install this as an app</strong>
      <p className="muted">Add Mastercraft to your home screen so it opens full-screen, like any other app.</p>
      <button type="button" className="btn primary compact" onClick={install}>INSTALL APP</button>
    </>}
  </div>;
}

function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}

export default function EmployeePage(){
  const router=useRouter(); const [data,setData]=useState(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(''); const [now,setNow]=useState(Date.now());
  const [materialId,setMaterialId]=useState(''); const [qty,setQty]=useState(1); const [transactionType,setTransactionType]=useState('issue');
  const [indirectType,setIndirectType]=useState('indirect');
  const load=useCallback(async()=>{ const res=await fetch('/api/employee/dashboard',{cache:'no-store'}); if(res.status===401){router.push('/login');return;} const json=await res.json(); if(!res.ok){setError(json.error||'Could not load');return;} setData(json); if(!materialId&&json.materials?.length)setMaterialId(String(json.materials[0].id)); },[router,materialId]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const elapsed=useMemo(()=>{ if(!data?.active?.started_at)return '00:00:00'; const sec=Math.max(0,Math.floor((now-new Date(data.active.started_at).getTime())/1000)); const h=String(Math.floor(sec/3600)).padStart(2,'0'); const m=String(Math.floor(sec%3600/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${h}:${m}:${s}`;},[data?.active?.started_at,now]);
  async function action(url,body,label){setBusy(label);setError('');try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});const j=await res.json();if(!res.ok)throw new Error(j.error||'Action failed');await load();}catch(e){setError(e.message);}finally{setBusy('');}}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}
  if(!data)return <main className="shell"><div className="container narrow"><div className="card">Loading shop data...</div></div></main>;
  const active=data.active;
  return <main className="shell"><div className="topbar"><div className="brand">MASTERCRAFT</div><button className="toplink" onClick={logout}>Sign out</button></div><div className="container narrow">
    <div className="card identity"><div><div className="kicker">Employee</div><div className="big">{data.employee.full_name}</div><div className="muted">{data.employee.departments?.name||'Unassigned Department'}</div></div><span className="badge active">Online</span></div>
    {error&&<div className="alert error">{error}</div>}
    <InstallBanner />
    {data.guidance?.length>0&&<div className="card"><div className="kicker">Today’s guidance</div>{data.guidance.map(g=><div className="guidance" key={g.id}><strong>{g.title}</strong>{g.instructions&&<div className="muted">{g.instructions}</div>}{g.daily_goal&&<div className="goal">Daily goal: {g.daily_goal}</div>}</div>)}</div>}
    {active ? <>
      <div className="card current-card"><div className="kicker">Current {active.operations?'Job':'Activity'}</div><div className="big jobno">{active.jobs?.job_number||cap(active.entry_type)}</div><div className="jobtitle">{active.jobs?.description||'Non-job time'}</div><div className="muted">{active.operations?.operation_name||''}</div><div className="timer">{elapsed}</div>
        {active.operations?<button className="btn good" onClick={()=>document.getElementById('material')?.scrollIntoView({behavior:'smooth'})}>ADD MATERIAL</button>:null}
        {active.operations?<>
          <button disabled={!!busy} className="btn secondary" onClick={()=>action('/api/employee/stop',{complete:false},'stop')}>{busy==='stop'?'STOPPING...':'STOP / CHANGE JOB'}</button>
          <button disabled={!!busy} className="btn danger" onClick={()=>action('/api/employee/stop',{complete:true},'complete')}>{busy==='complete'?'COMPLETING...':'COMPLETE OPERATION'}</button>
        </>:<button disabled={!!busy} className="btn secondary" onClick={()=>action('/api/employee/stop',{complete:false},'stop')}>{busy==='stop'?'STOPPING...':'CLOCK OUT'}</button>}
      </div>
      {active.operations?<div className="card" id="material"><div className="kicker">Material Usage</div><h2>Record material</h2>
        <div className="field"><label>Material</label><select value={materialId} onChange={e=>setMaterialId(e.target.value)}>{data.materials.map(m=><option key={m.id} value={m.id}>{m.item_code?`${m.item_code} · `:''}{m.description} ({m.unit_of_measure})</option>)}</select></div>
        <div className="grid two"><div className="field"><label>Quantity</label><input type="number" min="0.0001" step="0.1" value={qty} onChange={e=>setQty(e.target.value)} /></div><div className="field"><label>Type</label><select value={transactionType} onChange={e=>setTransactionType(e.target.value)}><option value="issue">Issue / Use</option><option value="return">Return</option></select></div></div>
        <button disabled={!!busy||!materialId} className="btn primary" onClick={()=>action('/api/employee/material',{materialId:Number(materialId),quantity:Number(qty),transactionType},'material')}>{busy==='material'?'SAVING...':'RECORD MATERIAL'}</button>
      </div>:null}
    </> : <>
      <div className="card"><div className="kicker">My Work</div><h2>Assigned Jobs</h2>{data.assignments.length===0&&<div className="empty">No active operations are assigned to you.</div>}
        {data.assignments.map(a=>{const o=a.operations;return <div key={a.id} className="work-item"><div className="row"><strong>{o.jobs?.job_number}</strong><span className={'badge '+(o.status==='in_progress'?'active':'queued')}>{String(o.status).replaceAll('_',' ')}</span></div><div className="jobtitle small">{o.jobs?.description}</div><div className="muted">{o.operation_name} · {o.departments?.name||''}{o.estimated_hours?` · Est. ${o.estimated_hours} hrs`:''}</div><button disabled={!!busy} className="btn primary compact" onClick={()=>action('/api/employee/start',{operationId:o.id},`start-${o.id}`)}>{busy===`start-${o.id}`?'STARTING...':'START JOB'}</button></div>})}
      </div>
      <div className="card"><div className="kicker">Other Time</div><h2>Not working a job right now?</h2><p className="muted">Clock indirect shop time, training, or a break. For PTO or a holiday, ask your admin to log it for you.</p>
        <div className="field"><label>Type</label><select value={indirectType} onChange={e=>setIndirectType(e.target.value)}><option value="indirect">Indirect / shop time</option><option value="training">Training</option><option value="break">Break</option></select></div>
        <button disabled={!!busy} className="btn secondary" onClick={()=>action('/api/employee/start-indirect',{entryType:indirectType},'startIndirect')}>{busy==='startIndirect'?'STARTING...':'CLOCK IN'}</button>
      </div>
    </>}
  </div></main>
}
