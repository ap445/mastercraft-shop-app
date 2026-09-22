'use client';
import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '../components/BrandMark';
import RoleNav from '../components/RoleNav';

const CAL_PALETTE=[{bg:'#2a78d6',fg:'#ffffff'},{bg:'#eb6834',fg:'#ffffff'},{bg:'#1baf7a',fg:'#0b0b0b'},{bg:'#eda100',fg:'#0b0b0b'},{bg:'#e87ba4',fg:'#0b0b0b'},{bg:'#008300',fg:'#ffffff'},{bg:'#4a3aa7',fg:'#ffffff'},{bg:'#e34948',fg:'#ffffff'}];
function deptColor(deptId,departments){const ids=(departments||[]).map(d=>String(d.id)).sort((a,b)=>Number(a)-Number(b));const idx=ids.indexOf(String(deptId));return CAL_PALETTE[(idx>=0?idx:0)%CAL_PALETTE.length];}
function parseDateOnly(s){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,(m||1)-1,d||1);}
function ymdKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function startOfWeek(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function addMonths(d,n){const x=new Date(d.getFullYear(),d.getMonth()+n,1);return x;}
function dayIndex(date,weekStart){return Math.round((date-weekStart)/86400000);}
function hoursFmt(h){return (Math.round((h||0)*100)/100).toFixed(2);}
function fmtDateTime(s){if(!s)return '—';const d=new Date(s);return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function fmtShortDate(d){return new Date(d+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function fmtPlanned(o){if(!o.planned_start)return '—';const start=String(o.planned_start).slice(0,10);const end=o.planned_finish?String(o.planned_finish).slice(0,10):'';if(!end||end===start)return fmtShortDate(start);return `${fmtShortDate(start)} – ${fmtShortDate(end)}`;}
function weekLayout(week,ops,maxTracks){const weekStart=week[0],weekEnd=week[6];const items=ops.filter(o=>o.start<=weekEnd&&o.end>=weekStart).map(o=>({...o,colStart:Math.max(0,dayIndex(o.start,weekStart)),colEnd:Math.min(6,dayIndex(o.end,weekStart))})).sort((a,b)=>a.colStart-b.colStart||(b.colEnd-b.colStart)-(a.colEnd-a.colStart));const tracks=[];const placed=[];const hiddenByDay=new Array(7).fill(0);for(const it of items){let trackIdx=tracks.findIndex(end=>it.colStart>end);if(trackIdx===-1&&tracks.length<maxTracks){trackIdx=tracks.length;tracks.push(-1);}if(trackIdx===-1){for(let d=it.colStart;d<=it.colEnd;d++)hiddenByDay[d]++;continue;}tracks[trackIdx]=it.colEnd;placed.push({...it,track:trackIdx});}return {placed,hiddenByDay};}

export default function SupervisorPage(){
  const router=useRouter(); const [data,setData]=useState(null); const [error,setError]=useState(''); const [now,setNow]=useState(Date.now());
  const [calView,setCalView]=useState('month'); const [calAnchor,setCalAnchor]=useState(()=>{const d=new Date();d.setHours(0,0,0,0);return d;});
  const [recordDetail,setRecordDetail]=useState(null);
  const load=useCallback(async()=>{const res=await fetch('/api/supervisor/dashboard',{cache:'no-store'});if(res.status===401||res.status===403){router.push('/login');return;}const j=await res.json();if(!res.ok){setError(j.error);return;}setData(j);},[router]);
  useEffect(()=>{load();const r=setInterval(load,15000);return()=>clearInterval(r);},[load]); useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}
  async function assign(operationId,employeeId){if(!employeeId)return;const res=await fetch('/api/supervisor/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId,employeeId:Number(employeeId)})});const j=await res.json();if(!res.ok)setError(j.error);else load();}
  const jobsInProgress=useMemo(()=>new Set((data?.active||[]).map(x=>x.jobs?.job_number).filter(Boolean)).size,[data]);
  function calPrev(){setCalAnchor(a=>calView==='month'?addMonths(a,-1):addDays(a,-7));}
  function calNext(){setCalAnchor(a=>calView==='month'?addMonths(a,1):addDays(a,7));}
  function calToday(){const d=new Date();d.setHours(0,0,0,0);setCalAnchor(d);}
  function jumpToWeek(day){setCalView('week');setCalAnchor(day);}
  function renderCalWeek(week,ops,maxTracks,showDayName){const today=ymdKey(new Date());const {placed,hiddenByDay}=weekLayout(week,ops,maxTracks);const rows=Math.max(1,placed.reduce((m,p)=>Math.max(m,p.track+1),0));return <div className="cal-week" key={ymdKey(week[0])}>
      <div className="cal-week-daynums">{week.map(d=>{const outside=calView==='month'&&d.getMonth()!==calAnchor.getMonth();return <div key={ymdKey(d)} className={"cal-daynum"+(outside?' outside':'')}>{showDayName?<span className="cal-dayname">{d.toLocaleDateString(undefined,{weekday:'short'})} </span>:null}<span className={ymdKey(d)===today?'cal-today':''}>{d.getDate()}</span></div>;})}</div>
      <div className="cal-week-bars" style={{gridTemplateRows:`repeat(${rows},22px)`}}>
        {placed.map(it=>{const c=deptColor(it.raw.department_id,data.departments);return <button key={it.raw.id} type="button" className={"cal-bar"+(it.raw.status==='complete'?' cal-bar-complete':'')} style={{gridColumn:`${it.colStart+1} / ${it.colEnd+2}`,gridRow:it.track+1,background:c.bg,color:c.fg}} onClick={()=>setRecordDetail({type:'operation',id:it.raw.id})} title={it.raw.job_description}>{it.colStart===dayIndex(it.start,week[0])?'':'‹ '}{it.raw.job_number} · {it.raw.operation_name}</button>;})}
      </div>
      {hiddenByDay.some(n=>n>0)?<div className="cal-week-more">{hiddenByDay.map((n,i)=>n>0?<button key={i} type="button" className="cal-more-btn" onClick={()=>jumpToWeek(week[i])}>+{n} more</button>:<div key={i}/>)}</div>:null}
    </div>;}
  const detail=useMemo(()=>{
    if(!recordDetail||!data)return null;
    const {type,id}=recordDetail;
    if(type==='job'){
      const job=data.jobs.find(j=>String(j.id)===String(id)); if(!job)return null;
      const ops=data.allOperations.filter(o=>String(o.job_id)===String(id)).sort((a,b)=>a.sequence_no-b.sequence_no);
      const te=data.timeEntries.filter(t=>String(t.job_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.job_id)===String(id));
      const jm=(data.jobMaterials||[]).filter(j=>String(j.job_id)===String(id));
      const estimatedHours=ops.reduce((s,o)=>s+Number(o.estimated_hours||0),0);
      const actualHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      return {type,job,ops,te,mt,jm,estimatedHours,actualHours};
    }
    if(type==='operation'){
      const op=data.allOperations.find(o=>String(o.id)===String(id)); if(!op)return null;
      const job=data.jobs.find(j=>String(j.id)===String(op.job_id));
      const te=data.timeEntries.filter(t=>String(t.operation_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.operation_id)===String(id));
      const actualHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      return {type,op,job,te,mt,actualHours};
    }
    if(type==='employee'){
      const employee=data.employees.find(e=>String(e.id)===String(id)); if(!employee)return null;
      const assigned=data.allOperations.filter(o=>(o.assigned||[]).some(a=>String(a.employee_id)===String(id))).sort((a,b)=>(a.planned_start||'').localeCompare(b.planned_start||''));
      const te=data.timeEntries.filter(t=>String(t.employee_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.employee_id)===String(id));
      const totalHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      return {type,employee,assigned,te,mt,totalHours};
    }
    if(type==='material'){
      const material=data.materials.find(m=>String(m.id)===String(id)); if(!material)return null;
      const mt=data.materialTransactions.filter(m=>String(m.material_id)===String(id));
      const netQty=mt.reduce((s,m)=>s+Number(m.quantity||0)*(m.transaction_type==='return'?-1:1),0);
      const jm=(data.jobMaterials||[]).filter(j=>String(j.material_id)===String(id));
      return {type,material,mt,netQty,jm};
    }
    return null;
  },[recordDetail,data]);
  function renderDetail(){
    if(!recordDetail)return null;
    if(!detail)return <div className="card" id="record-detail">That record could not be found.<button type="button" className="btn secondary compact" onClick={()=>setRecordDetail(null)}>CLOSE</button></div>;
    const closeBtn=<button type="button" className="btn secondary compact" style={{marginTop:0}} onClick={()=>setRecordDetail(null)}>CLOSE</button>;
    const xref=(type,id,label)=>id?<button type="button" className="xref" onClick={()=>setRecordDetail({type,id})}>{label}</button>:(label||'—');
    if(detail.type==='job'){
      const {job,ops,te,mt,jm,estimatedHours,actualHours}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Job detail</div>{closeBtn}</div>
        <h2>{job.job_number} — {job.description}</h2>
        <p className="muted">{job.customer_name||'No customer on file'} · <span className="badge">{String(job.status).replaceAll('_',' ')}</span> · {hoursFmt(actualHours)} of {hoursFmt(estimatedHours)} estimated hours logged</p>
        <div className="kicker" style={{marginTop:'14px'}}>Planned materials</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Planned qty</th><th>Notes</th></tr></thead><tbody>
          {jm.length===0?<tr><td colSpan="3" className="muted">No materials planned for this job yet.</td></tr>:jm.map(j=><tr key={j.id}><td>{xref('material',j.material_id,<><strong>{j.item_code}</strong> {j.material_description}</>)}</td><td>{j.planned_quantity} {j.unit_of_measure}</td><td>{j.notes||'—'}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Schedule (operations)</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>#</th><th>Operation</th><th>Dept</th><th>Est.</th><th>Assigned</th><th>Status</th></tr></thead><tbody>
          {ops.length===0?<tr><td colSpan="6" className="muted">No operations scheduled yet.</td></tr>:ops.map(o=><tr key={o.id}><td><button type="button" className="xref" onClick={()=>setRecordDetail({type:'operation',id:o.id})}>{o.sequence_no}</button></td><td><button type="button" className="xref" onClick={()=>setRecordDetail({type:'operation',id:o.id})}>{o.operation_name}</button></td><td>{o.department_name}</td><td>{o.estimated_hours||'—'}</td><td>{(o.assigned||[]).length===0?'—':o.assigned.map((a,i)=><span key={a.employee_id}>{i>0?', ':''}{xref('employee',a.employee_id,a.full_name)}</span>)}</td><td><span className="badge">{String(o.status).replaceAll('_',' ')}</span></td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Time entries</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Employee</th><th>Operation</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="5" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('employee',t.employee_id,t.employee_name)}</td><td>{xref('operation',t.operation_id,t.operation_name||'—')}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Material transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Type</th><th>Qty</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="5" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    if(detail.type==='operation'){
      const {op,job,te,mt,actualHours}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Schedule step detail</div>{closeBtn}</div>
        <h2>#{op.sequence_no} {op.operation_name} <span className="muted">({op.department_name})</span></h2>
        <p className="muted">{op.job_number?<>Job <strong>{op.job_number}</strong> — {op.job_description}</>:'No job on file'} · <span className="badge">{String(op.status).replaceAll('_',' ')}</span> · {hoursFmt(actualHours)} of {op.estimated_hours||'0'} estimated hours logged</p>
        {job?<p className="hint"><a href="#" onClick={e=>{e.preventDefault();setRecordDetail({type:'job',id:job.id});}}>See the full job →</a></p>:null}
        <div className="kicker" style={{marginTop:'10px'}}>Assigned</div>
        <p>{(op.assigned||[]).length===0?<span className="muted">No one assigned yet — assign from the Operations Board above.</span>:op.assigned.map(a=><button type="button" key={a.employee_id} className="badge" style={{marginRight:'6px',border:0,cursor:'pointer'}} onClick={()=>setRecordDetail({type:'employee',id:a.employee_id})}>{a.full_name}</button>)}</p>
        <div className="kicker" style={{marginTop:'14px'}}>Time entries</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Employee</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="4" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('employee',t.employee_id,t.employee_name)}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Material transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Type</th><th>Qty</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="5" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    if(detail.type==='employee'){
      const {employee,assigned,te,mt,totalHours}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Employee detail</div>{closeBtn}</div>
        <h2>{employee.full_name} <span className="muted">({employee.employee_code})</span></h2>
        <p className="muted">{employee.department_name||'No department'} · <span className="badge">{employee.role}</span>{employee.active===false?<span className="badge"> inactive</span>:null} · {hoursFmt(totalHours)} hours logged total</p>
        <div className="kicker" style={{marginTop:'14px'}}>Assigned schedule steps</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Operation</th><th>Dept</th><th>Planned</th><th>Status</th></tr></thead><tbody>
          {assigned.length===0?<tr><td colSpan="5" className="muted">Not assigned to anything yet.</td></tr>:assigned.map(o=><tr key={o.id}><td>{xref('job',o.job_id,o.job_number)}</td><td><button type="button" className="xref" onClick={()=>setRecordDetail({type:'operation',id:o.id})}>#{o.sequence_no} {o.operation_name}</button></td><td>{o.department_name}</td><td>{fmtPlanned(o)}</td><td><span className="badge">{String(o.status).replaceAll('_',' ')}</span></td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Time logged</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Operation</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="5" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('job',t.job_id,t.job_number||'—')}</td><td>{xref('operation',t.operation_id,t.operation_name||'—')}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Materials issued/returned</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Material</th><th>Type</th><th>Qty</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="5" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('job',m.job_id,m.job_number||'—')}</td><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    if(detail.type==='material'){
      const {material,mt,netQty,jm}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Material detail</div>{closeBtn}</div>
        <h2>{material.item_code} <span className="muted">— {material.description}</span></h2>
        <p className="muted">{material.unit_of_measure}{material.active===false?<span className="badge"> inactive</span>:null} · net {netQty.toFixed(2)} {material.unit_of_measure} issued</p>
        <div className="kicker" style={{marginTop:'14px'}}>Planned for jobs</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Planned qty</th><th>Notes</th></tr></thead><tbody>
          {jm.length===0?<tr><td colSpan="3" className="muted">Not planned for any job yet.</td></tr>:jm.map(j=><tr key={j.id}><td>{xref('job',j.job_id,j.job_number)}</td><td>{j.planned_quantity} {material.unit_of_measure}</td><td>{j.notes||'—'}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Type</th><th>Qty</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="5" className="muted">No transactions logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('job',m.job_id,m.job_number||'—')}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    return null;
  }
  if(!data)return <main className="shell"><div className="container"><div className="card">Loading supervisor dashboard...</div></div></main>;
  return <main className="shell"><div className="topbar"><a className="brand" href="/supervisor"><BrandMark />MASTERCRAFT SUPERVISOR</a><div className="navlinks"><a className="navlink" href="#calendar">Calendar</a><a className="navlink" href="#records">Records</a><RoleNav current="supervisor" /><button className="toplink" onClick={logout}>Sign out</button></div></div><div className="container">
    {error&&<div className="alert error">{error}</div>}
    <div className="grid three"><div className="card metric"><div className="kicker">Working Now</div><div className="big">{data.active.length}</div><div className="muted">employees on active jobs</div></div><div className="card metric"><div className="kicker">Jobs In Progress</div><div className="big">{jobsInProgress}</div><div className="muted">across the shop</div></div><div className="card metric"><div className="kicker">Open Operations</div><div className="big">{data.operations.length}</div><div className="muted">queued or in progress</div></div></div>
    <div className="card"><div className="row"><div><div className="kicker">Live Floor</div><h2>Who is working on what?</h2></div><span className="badge active">Live</span></div><p className="hint">Click a name, job, or operation to see its full record below.</p><div className="table-wrap"><table className="table"><thead><tr><th>Employee</th><th>Job</th><th>Operation</th><th>Department</th><th>Elapsed</th></tr></thead><tbody>{data.active.length===0?<tr><td colSpan="5" className="muted">No active timers.</td></tr>:data.active.map(r=>{const mins=Math.max(0,Math.floor((now-new Date(r.started_at).getTime())/60000));return <tr key={r.id}><td>{r.employees?.id?<button type="button" className="xref" onClick={()=>setRecordDetail({type:'employee',id:r.employees.id})}>{r.employees.full_name}</button>:r.employees?.full_name}</td><td>{r.jobs?.id?<button type="button" className="xref" onClick={()=>setRecordDetail({type:'job',id:r.jobs.id})}>{r.jobs.job_number}</button>:r.jobs?.job_number}</td><td>{r.operations?.id?<button type="button" className="xref" onClick={()=>setRecordDetail({type:'operation',id:r.operations.id})}>{r.operations.operation_name}</button>:r.operations?.operation_name}</td><td>{r.operations?.departments?.name}</td><td>{Math.floor(mins/60)}h {mins%60}m</td></tr>})}</tbody></table></div></div>
    <div className="card"><div className="kicker">Department Schedule</div><h2>Operations Board</h2><p className="hint">Click a job, operation, or assigned name to see its full record below.</p><div className="table-wrap"><table className="table"><thead><tr><th>Job</th><th>Description</th><th>Department</th><th>Operation</th><th>Assigned</th><th>Est.</th><th>Status</th></tr></thead><tbody>{data.operations.map(o=><tr key={o.id}><td><strong><button type="button" className="xref" onClick={()=>setRecordDetail({type:'job',id:o.jobs?.id})}>{o.jobs?.job_number}</button></strong></td><td>{o.jobs?.description}</td><td>{o.departments?.name}</td><td><button type="button" className="xref" onClick={()=>setRecordDetail({type:'operation',id:o.id})}>{o.operation_name}</button></td><td><div className="assigned-list">{(o.assignments||[]).map(a=><button type="button" className="badge" key={a.id} style={{border:0,cursor:'pointer'}} onClick={()=>setRecordDetail({type:'employee',id:a.employees?.id})}>{a.employees?.full_name}</button>)}</div><select className="inline-select" defaultValue="" onChange={e=>assign(o.id,e.target.value)}><option value="">+ Assign</option>{data.employees.map(emp=><option key={emp.id} value={emp.id}>{emp.full_name}</option>)}</select></td><td>{o.estimated_hours||'—'}</td><td><span className={'badge '+(o.status==='in_progress'?'active':'queued')}>{String(o.status).replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div></div>

    <section id="calendar" className="card"><div className="kicker">Scheduling</div><h2>Shop calendar</h2><p className="muted">Every job's scheduled operations, by department. Click a bar to see its full record below.</p><div className="cal-card">
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <button type="button" className="cal-nav-btn" onClick={calPrev}>‹</button>
          <button type="button" className="cal-nav-btn" onClick={calToday}>Today</button>
          <button type="button" className="cal-nav-btn" onClick={calNext}>›</button>
          <strong className="cal-label">{calView==='month'?calAnchor.toLocaleDateString(undefined,{month:'long',year:'numeric'}):(()=>{const w=startOfWeek(calAnchor);return w.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' – '+addDays(w,6).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});})()}</strong>
        </div>
        <div className="cal-toolbar-right">
          <button type="button" className={"cal-nav-btn"+(calView==='month'?' active':'')} onClick={()=>setCalView('month')}>Month</button>
          <button type="button" className={"cal-nav-btn"+(calView==='week'?' active':'')} onClick={()=>setCalView('week')}>Week</button>
        </div>
      </div>
      <div className="cal-dow-row">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="cal-dow">{d}</div>)}</div>
      {(()=>{
        const calOps=(data.allOperations||[]).filter(o=>o.planned_start).map(o=>{const start=parseDateOnly(o.planned_start);let end=o.planned_finish?parseDateOnly(o.planned_finish):start;if(end<start)end=start;return {raw:o,start,end};});
        if(calView==='month'){
          const first=new Date(calAnchor.getFullYear(),calAnchor.getMonth(),1);
          const gridStart=startOfWeek(first);
          const weeks=[];
          for(let w=0;w<6;w++){const week=[];for(let i=0;i<7;i++)week.push(addDays(gridStart,w*7+i));weeks.push(week);}
          return weeks.map(week=>renderCalWeek(week,calOps,3,false));
        }
        const week=[];const ws=startOfWeek(calAnchor);for(let i=0;i<7;i++)week.push(addDays(ws,i));
        return renderCalWeek(week,calOps,8,true);
      })()}
      {(data.allOperations||[]).every(o=>!o.planned_start)?<p className="muted" style={{marginTop:'10px'}}>No operations have planned dates yet.</p>:null}
    </div></section>

    <section id="records"><div className="section-heading"><div><div className="kicker">Reference library</div><h2>Shop records</h2><p className="muted">Look up any job, schedule step, team member, or material. Click a row to see everything linked to it below.</p></div></div><div className="grid two"><div className="card"><div className="kicker">Jobs</div><div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Customer</th><th>Status</th></tr></thead><tbody>{data.jobs.length===0?<tr><td colSpan="3" className="muted">No jobs yet.</td></tr>:data.jobs.map(j=><tr key={j.id} style={{cursor:'pointer',background:recordDetail?.type==='job'&&String(recordDetail.id)===String(j.id)?'#f3f4f6':undefined}} onClick={()=>setRecordDetail({type:'job',id:j.id})}><td><strong>{j.job_number}</strong><br/><span className="muted">{j.description}</span></td><td>{j.customer_name||'—'}</td><td><span className="badge">{j.status.replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div></div><div className="card"><div className="kicker">Team</div><div className="table-wrap"><table className="table compact-table"><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Role</th></tr></thead><tbody>{data.employees.map(e=><tr key={e.id} style={{cursor:'pointer',background:recordDetail?.type==='employee'&&String(recordDetail.id)===String(e.id)?'#f3f4f6':undefined}} onClick={()=>setRecordDetail({type:'employee',id:e.id})}><td>{e.employee_code}</td><td>{e.full_name}</td><td>{e.departments?.name||'—'}</td><td><span className="badge">{e.role}</span></td></tr>)}</tbody></table></div></div><div className="card"><div className="kicker">Materials</div><div className="table-wrap"><table className="table compact-table"><thead><tr><th>Item code</th><th>Description</th><th>UOM</th><th></th></tr></thead><tbody>{data.materials.length===0?<tr><td colSpan="4" className="muted">No materials yet.</td></tr>:data.materials.map(m=><tr key={m.id} style={{cursor:'pointer',background:recordDetail?.type==='material'&&String(recordDetail.id)===String(m.id)?'#f3f4f6':undefined}} onClick={()=>setRecordDetail({type:'material',id:m.id})}><td><strong>{m.item_code}</strong></td><td>{m.description}</td><td>{m.unit_of_measure}</td><td>{m.active===false?<span className="badge">inactive</span>:null}</td></tr>)}</tbody></table></div></div><div className="card"><div className="kicker">Daily guidance</div><div className="table-wrap"><table className="table compact-table"><thead><tr><th>Applies to</th><th>Date</th><th>Title</th><th>Goal</th></tr></thead><tbody>{data.guidance.length===0?<tr><td colSpan="4" className="muted">No daily guidance yet.</td></tr>:data.guidance.map(g=><tr key={g.id}><td><span className="badge">{g.scope_type==='job'?`${g.job_number} · ${g.department_name}`:g.scope_type==='department'?g.department_name:g.role}</span></td><td>{g.scope_type==='job'?(g.guidance_date?String(g.guidance_date).slice(0,10):'Every day'):'—'}</td><td><strong>{g.title}</strong><br/><span className="muted">{g.instructions||'—'}</span></td><td>{g.daily_goal||'—'}</td></tr>)}</tbody></table></div></div></div>
      {renderDetail()}
    </section>
  </div></main>
}
