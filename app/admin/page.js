'use client';
import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '../components/BrandMark';
import RoleNav from '../components/RoleNav';

const blank = { department:{id:'',name:'',active:true}, employee:{id:'',employeeCode:'',fullName:'',departmentId:'',role:'employee',pin:'',active:true}, job:{id:'',jobNumber:'',customerName:'',description:'',dueDate:'',priority:'3',status:'not_started'}, material:{id:'',itemCode:'',description:'',unitOfMeasure:'ea',standardCost:'',active:true}, guidance:{id:'',scopeType:'role',role:'employee',departmentId:'',jobId:'',title:'',instructions:'',dailyGoal:''}, operation:{id:'',jobId:'',departmentId:'',operationName:'',sequenceNo:'1',estimatedHours:'',plannedStart:'',plannedFinish:'',status:'queued'}, jobMaterial:{id:'',jobId:'',materialId:'',plannedQuantity:'',notes:''} };
const CAL_PALETTE=[{bg:'#2a78d6',fg:'#ffffff'},{bg:'#eb6834',fg:'#ffffff'},{bg:'#1baf7a',fg:'#0b0b0b'},{bg:'#eda100',fg:'#0b0b0b'},{bg:'#e87ba4',fg:'#0b0b0b'},{bg:'#008300',fg:'#ffffff'},{bg:'#4a3aa7',fg:'#ffffff'},{bg:'#e34948',fg:'#ffffff'}];
function deptColor(deptId,departments){const ids=(departments||[]).map(d=>String(d.id)).sort((a,b)=>Number(a)-Number(b));const idx=ids.indexOf(String(deptId));return CAL_PALETTE[(idx>=0?idx:0)%CAL_PALETTE.length];}
function parseDateOnly(s){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,(m||1)-1,d||1);}
function ymdKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function startOfWeek(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x;}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function addMonths(d,n){const x=new Date(d.getFullYear(),d.getMonth()+n,1);return x;}
function dayIndex(date,weekStart){return Math.round((date-weekStart)/86400000);}
function hoursFmt(h){return (Math.round((h||0)*100)/100).toFixed(2);}
function money(n){return '$'+(Math.round((n||0)*100)/100).toFixed(2);}
function fmtDateTime(s){if(!s)return '—';const d=new Date(s);return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function fmtShortDate(d){return new Date(d+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function fmtPlanned(o){if(!o.planned_start)return '—';const start=String(o.planned_start).slice(0,10);const end=o.planned_finish?String(o.planned_finish).slice(0,10):'';if(!end||end===start)return fmtShortDate(start);return `${fmtShortDate(start)} – ${fmtShortDate(end)}`;}
function weekLayout(week,ops,maxTracks){const weekStart=week[0],weekEnd=week[6];const items=ops.filter(o=>o.start<=weekEnd&&o.end>=weekStart).map(o=>({...o,colStart:Math.max(0,dayIndex(o.start,weekStart)),colEnd:Math.min(6,dayIndex(o.end,weekStart))})).sort((a,b)=>a.colStart-b.colStart||(b.colEnd-b.colStart)-(a.colEnd-a.colStart));const tracks=[];const placed=[];const hiddenByDay=new Array(7).fill(0);for(const it of items){let trackIdx=tracks.findIndex(end=>it.colStart>end);if(trackIdx===-1&&tracks.length<maxTracks){trackIdx=tracks.length;tracks.push(-1);}if(trackIdx===-1){for(let d=it.colStart;d<=it.colEnd;d++)hiddenByDay[d]++;continue;}tracks[trackIdx]=it.colEnd;placed.push({...it,track:trackIdx});}return {placed,hiddenByDay};}


export default function AdminPage(){
  const router=useRouter(); const [data,setData]=useState(null); const [forms,setForms]=useState(blank); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false); const [importing,setImporting]=useState(false); const [importFeedback,setImportFeedback]=useState(''); const [calView,setCalView]=useState('month'); const [calAnchor,setCalAnchor]=useState(()=>{const d=new Date();d.setHours(0,0,0,0);return d;}); const [recordDetail,setRecordDetail]=useState(null); const [pendingScroll,setPendingScroll]=useState(false); const [openForms,setOpenForms]=useState({team:false,departments:false,materials:false,guidance:false}); const [recordsTab,setRecordsTab]=useState('jobs');
  function openForm(name){setOpenForms(f=>({...f,[name]:true}));}
  function toggleForm(name){setOpenForms(f=>({...f,[name]:!f[name]}));}
  const detail=useMemo(()=>{
    if(!recordDetail||!data)return null;
    const {type,id}=recordDetail;
    if(type==='job'){
      const job=data.jobs.find(j=>String(j.id)===String(id)); if(!job)return null;
      const ops=data.operations.filter(o=>String(o.job_id)===String(id)).sort((a,b)=>a.sequence_no-b.sequence_no);
      const te=data.timeEntries.filter(t=>String(t.job_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.job_id)===String(id));
      const estimatedHours=ops.reduce((s,o)=>s+Number(o.estimated_hours||0),0);
      const actualHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      const materialCost=mt.reduce((s,m)=>s+Number(m.quantity||0)*Number(m.unit_cost||0)*(m.transaction_type==='return'?-1:1),0);
      const jm=(data.jobMaterials||[]).filter(j=>String(j.job_id)===String(id));
      const plannedMaterialCost=jm.reduce((s,j)=>s+Number(j.planned_quantity||0)*Number(j.standard_cost||0),0);
      return {type,job,ops,te,mt,jm,estimatedHours,actualHours,materialCost,plannedMaterialCost};
    }
    if(type==='operation'){
      const op=data.operations.find(o=>String(o.id)===String(id)); if(!op)return null;
      const job=data.jobs.find(j=>String(j.id)===String(op.job_id));
      const te=data.timeEntries.filter(t=>String(t.operation_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.operation_id)===String(id));
      const actualHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      const materialCost=mt.reduce((s,m)=>s+Number(m.quantity||0)*Number(m.unit_cost||0)*(m.transaction_type==='return'?-1:1),0);
      return {type,op,job,te,mt,actualHours,materialCost};
    }
    if(type==='employee'){
      const employee=data.employees.find(e=>String(e.id)===String(id)); if(!employee)return null;
      const assigned=data.operations.filter(o=>(o.assigned||[]).some(a=>String(a.employee_id)===String(id))).sort((a,b)=>(a.planned_start||'').localeCompare(b.planned_start||''));
      const te=data.timeEntries.filter(t=>String(t.employee_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.employee_id)===String(id));
      const totalHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      return {type,employee,assigned,te,mt,totalHours};
    }
    if(type==='material'){
      const material=data.materials.find(m=>String(m.id)===String(id)); if(!material)return null;
      const mt=data.materialTransactions.filter(m=>String(m.material_id)===String(id));
      const netQty=mt.reduce((s,m)=>s+Number(m.quantity||0)*(m.transaction_type==='return'?-1:1),0);
      const netCost=mt.reduce((s,m)=>s+Number(m.quantity||0)*Number(m.unit_cost||0)*(m.transaction_type==='return'?-1:1),0);
      const jm=(data.jobMaterials||[]).filter(j=>String(j.material_id)===String(id));
      return {type,material,mt,netQty,netCost,jm};
    }
    return null;
  },[recordDetail,data]);
  useEffect(()=>{if(pendingScroll&&detail){document.getElementById('record-detail')?.scrollIntoView({behavior:'smooth',block:'start'});setPendingScroll(false);}},[pendingScroll,detail]);
  function showRecord(rd){setRecordDetail(rd);setPendingScroll(true);}
  const load=useCallback(async()=>{const res=await fetch('/api/admin/setup',{cache:'no-store'}); if(res.status===401||res.status===403){router.push('/login');return null;} const json=await res.json();if(!res.ok){setError(json.error);return null;} setData(json);return json;},[router]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);const d=params.get('detail');if(d){const dash=d.indexOf('-');const type=d.slice(0,dash),id=d.slice(dash+1);if(['job','operation','employee','material'].includes(type)&&id){showRecord({type,id});}}}catch{}},[]);
  function change(type,key,value){setForms(f=>({...f,[type]:{...f[type],[key]:value}}));}
function calPrev(){setCalAnchor(a=>calView==='month'?addMonths(a,-1):addDays(a,-7));}
function calNext(){setCalAnchor(a=>calView==='month'?addMonths(a,1):addDays(a,7));}
function calToday(){const d=new Date();d.setHours(0,0,0,0);setCalAnchor(d);}
function jumpToWeek(day){setCalView('week');setCalAnchor(day);}
function renderCalWeek(week,ops,maxTracks,showDayName){const today=ymdKey(new Date());const {placed,hiddenByDay}=weekLayout(week,ops,maxTracks);const rows=Math.max(1,placed.reduce((m,p)=>Math.max(m,p.track+1),0));return <div className="cal-week" key={ymdKey(week[0])}>
    <div className="cal-week-daynums">{week.map(d=>{const outside=calView==='month'&&d.getMonth()!==calAnchor.getMonth();return <div key={ymdKey(d)} className={"cal-daynum"+(outside?' outside':'')}>{showDayName?<span className="cal-dayname">{d.toLocaleDateString(undefined,{weekday:'short'})} </span>:null}<span className={ymdKey(d)===today?'cal-today':''}>{d.getDate()}</span></div>;})}</div>
    <div className="cal-week-bars" style={{gridTemplateRows:`repeat(${rows},22px)`}}>
      {placed.map(it=>{const c=deptColor(it.raw.department_id,data.departments);return <button key={it.raw.id} type="button" className={"cal-bar"+(it.raw.status==='complete'?' cal-bar-complete':'')} style={{gridColumn:`${it.colStart+1} / ${it.colEnd+2}`,gridRow:it.track+1,background:c.bg,color:c.fg}} onClick={()=>edit('operation',it.raw)} title={it.raw.job_description}>{it.colStart===dayIndex(it.start,week[0])?'':'‹ '}{it.raw.job_number} · {it.raw.operation_name}</button>;})}
    </div>
    {hiddenByDay.some(n=>n>0)?<div className="cal-week-more">{hiddenByDay.map((n,i)=>n>0?<button key={i} type="button" className="cal-more-btn" onClick={()=>jumpToWeek(week[i])}>+{n} more</button>:<div key={i}/>)}</div>:null}
  </div>;}

  function renderDetail(){
    if(!recordDetail)return null;
    if(!detail)return <div className="card empty" id="record-detail">That record could not be found — it may have been removed.<button type="button" className="btn secondary compact" onClick={()=>setRecordDetail(null)}>CLOSE</button></div>;
    const closeBtn=<button type="button" className="btn secondary compact" style={{marginTop:0}} onClick={()=>setRecordDetail(null)}>CLOSE</button>;
    const xref=(type,id,label)=>id?<button type="button" className="xref" onClick={()=>showRecord({type,id})}>{label}</button>:(label||'—');
    if(detail.type==='job'){
      const {job,ops,te,mt,jm,estimatedHours,actualHours,materialCost,plannedMaterialCost}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Job detail</div>{closeBtn}</div>
        <h2>{job.job_number} — {job.description}</h2>
        <p className="muted">{job.customer_name||'No customer on file'} · <span className="badge">{String(job.status).replaceAll('_',' ')}</span> · {hoursFmt(actualHours)} of {hoursFmt(estimatedHours)} estimated hours logged · {money(materialCost)} actual vs {money(plannedMaterialCost)} planned in materials · <a href="/admin/costing">Full costing view</a> · <a className="xref" href={`/admin/job?job=${job.id}`}>Manage in Job Setup</a></p>
        <div className="kicker" style={{marginTop:'14px'}}>Planned materials</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Planned qty</th><th>Planned cost</th><th>Notes</th><th></th></tr></thead><tbody>
          {jm.length===0?<tr><td colSpan="5" className="muted">No materials planned for this job yet.</td></tr>:jm.map(j=><tr key={j.id}><td>{xref('material',j.material_id,<><strong>{j.item_code}</strong> {j.material_description}</>)}</td><td>{j.planned_quantity} {j.unit_of_measure}</td><td>{money(Number(j.planned_quantity||0)*Number(j.standard_cost||0))}</td><td>{j.notes||'—'}</td><td><button type="button" className="xref" onClick={()=>edit('jobMaterial',j)}>Edit</button></td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Schedule (operations)</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>#</th><th>Operation</th><th>Dept</th><th>Est.</th><th>Assigned</th><th>Status</th></tr></thead><tbody>
          {ops.length===0?<tr><td colSpan="6" className="muted">No operations scheduled yet.</td></tr>:ops.map(o=><tr key={o.id}><td><button type="button" className="xref" onClick={()=>showRecord({type:'operation',id:o.id})}>{o.sequence_no}</button></td><td><button type="button" className="xref" onClick={()=>showRecord({type:'operation',id:o.id})}>{o.operation_name}</button></td><td>{o.department_name}</td><td>{o.estimated_hours||'—'}</td><td>{(o.assigned||[]).length===0?'—':o.assigned.map((a,i)=><span key={a.employee_id}>{i>0?', ':''}{xref('employee',a.employee_id,a.full_name)}</span>)}</td><td><span className="badge">{String(o.status).replaceAll('_',' ')}</span></td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Time entries</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Employee</th><th>Operation</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="5" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('employee',t.employee_id,t.employee_name)}</td><td>{xref('operation',t.operation_id,t.operation_name||'—')}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Material transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Type</th><th>Qty</th><th>Total</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="6" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{money(Number(m.quantity)*Number(m.unit_cost||0))}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    if(detail.type==='operation'){
      const {op,job,te,mt,actualHours,materialCost}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Schedule step detail</div>{closeBtn}</div>
        <h2>#{op.sequence_no} {op.operation_name} <span className="muted">({op.department_name})</span></h2>
        <p className="muted">{op.job_number?<>Job <strong>{op.job_number}</strong> — {op.job_description}</>:'No job on file'} · <span className="badge">{String(op.status).replaceAll('_',' ')}</span> · {hoursFmt(actualHours)} of {op.estimated_hours||'0'} estimated hours logged · {money(materialCost)} in materials</p>
        {job?<p className="hint"><a href="#" onClick={e=>{e.preventDefault();showRecord({type:'job',id:job.id});}}>See the full job →</a></p>:null}
        <div className="kicker" style={{marginTop:'10px'}}>Assigned</div>
        <p>{(op.assigned||[]).length===0?<span className="muted">No one assigned yet — do that from the Supervisor Board.</span>:op.assigned.map(a=><button type="button" key={a.employee_id} className="badge" style={{marginRight:'6px',border:0,cursor:'pointer'}} onClick={()=>showRecord({type:'employee',id:a.employee_id})}>{a.full_name}</button>)}</p>
        <div className="kicker" style={{marginTop:'14px'}}>Time entries</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Employee</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="4" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('employee',t.employee_id,t.employee_name)}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Material transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Type</th><th>Qty</th><th>Total</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="6" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{money(Number(m.quantity)*Number(m.unit_cost||0))}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
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
          {assigned.length===0?<tr><td colSpan="5" className="muted">Not assigned to anything yet.</td></tr>:assigned.map(o=><tr key={o.id}><td>{xref('job',o.job_id,o.job_number)}</td><td><button type="button" className="xref" onClick={()=>showRecord({type:'operation',id:o.id})}>#{o.sequence_no} {o.operation_name}</button></td><td>{o.department_name}</td><td>{fmtPlanned(o)}</td><td><span className="badge">{String(o.status).replaceAll('_',' ')}</span></td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Time logged</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Operation</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="5" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('job',t.job_id,t.job_number||'—')}</td><td>{xref('operation',t.operation_id,t.operation_name||'—')}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Materials issued/returned</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Material</th><th>Type</th><th>Qty</th><th>Total</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="6" className="muted">No materials logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('job',m.job_id,m.job_number||'—')}</td><td>{xref('material',m.material_id,<><strong>{m.item_code}</strong> {m.material_description}</>)}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{money(Number(m.quantity)*Number(m.unit_cost||0))}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    if(detail.type==='material'){
      const {material,mt,netQty,netCost,jm}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Material detail</div>{closeBtn}</div>
        <h2>{material.item_code} <span className="muted">— {material.description}</span></h2>
        <p className="muted">{material.unit_of_measure}{material.standard_cost==null?'':` · standard cost ${money(material.standard_cost)}`}{material.active===false?<span className="badge"> inactive</span>:null} · net {netQty.toFixed(2)} {material.unit_of_measure} issued · {money(netCost)} net cost</p>
        <div className="kicker" style={{marginTop:'14px'}}>Planned for jobs</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Planned qty</th><th>Planned cost</th><th>Notes</th></tr></thead><tbody>
          {jm.length===0?<tr><td colSpan="4" className="muted">Not planned for any job yet.</td></tr>:jm.map(j=><tr key={j.id}><td>{xref('job',j.job_id,j.job_number)}</td><td>{j.planned_quantity} {material.unit_of_measure}</td><td>{money(Number(j.planned_quantity||0)*Number(material.standard_cost||0))}</td><td>{j.notes||'—'}</td></tr>)}
        </tbody></table></div>
        <div className="kicker" style={{marginTop:'14px'}}>Transactions</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Type</th><th>Qty</th><th>Total</th><th>Employee</th><th>Date</th></tr></thead><tbody>
          {mt.length===0?<tr><td colSpan="6" className="muted">No transactions logged yet.</td></tr>:mt.map(m=><tr key={m.id}><td>{xref('job',m.job_id,m.job_number||'—')}</td><td><span className="badge">{m.transaction_type}</span></td><td>{m.quantity} {m.unit_of_measure}</td><td>{money(Number(m.quantity)*Number(m.unit_cost||0))}</td><td>{xref('employee',m.employee_id,m.employee_name)}</td><td>{fmtDateTime(m.occurred_at)}</td></tr>)}
        </tbody></table></div>
      </div>;
    }
    return null;
  }

  function edit(type,item){
    const jobForSetup=type==='job'?item.id:(type==='operation'||type==='jobMaterial')?item.job_id:(type==='guidance'&&item.scope_type==='job')?item.job_id:null;
    if(jobForSetup){router.push(`/admin/job?job=${jobForSetup}`);return;}
    const values=type==='employee'?{id:item.id,employeeCode:item.employee_code,fullName:item.full_name,departmentId:item.department_id||'',role:item.role,pin:'',active:item.active}:type==='material'?{id:item.id,itemCode:item.item_code,description:item.description,unitOfMeasure:item.unit_of_measure,standardCost:item.standard_cost??'',active:item.active}:type==='department'?{id:item.id,name:item.name,active:item.active}:{id:item.id,scopeType:item.scope_type,role:item.role||'employee',departmentId:item.department_id||'',jobId:item.job_id||'',title:item.title,instructions:item.instructions||'',dailyGoal:item.daily_goal||''};
    setForms(f=>({...f,[type]:values}));
    const formName=type==='employee'?'team':type==='material'?'materials':type==='department'?'departments':'guidance';
    openForm(formName);
    document.getElementById(formName)?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function toggleActive(type,item){
    setBusy(true);setError('');setNotice('');
    const nextActive=item.active===false;
    try{
      const body=type==='employee'?{type:'employee',id:item.id,employeeCode:item.employee_code,fullName:item.full_name,departmentId:item.department_id||'',role:item.role,pin:'',active:nextActive}
        :type==='material'?{type:'material',id:item.id,itemCode:item.item_code,description:item.description,unitOfMeasure:item.unit_of_measure,standardCost:item.standard_cost??'',active:nextActive}
        :{type:'department',id:item.id,name:item.name,active:nextActive};
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const json=await res.json();if(!res.ok)throw new Error(json.error);
      await load();
      setNotice(nextActive?'Reactivated.':'Deactivated.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function removeEntity(type,id,label){
    if(!confirm(`Delete this ${label}? This can't be undone.`))return;
    setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type+'Delete',id})});
      const json=await res.json();if(!res.ok)throw new Error(json.error);
      if(recordDetail&&recordDetail.type===type&&String(recordDetail.id)===String(id))setRecordDetail(null);
      if(forms[type]?.id&&String(forms[type].id)===String(id))setForms(f=>({...f,[type]:blank[type]}));
      await load();
      setNotice('Deleted.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function uploadGuidanceAttachment(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!forms.guidance.id){setError('Save this expectation before attaching documents.');return;}setBusy(true);setError('');setNotice('');try{const fd=new FormData();fd.append('guidanceId',forms.guidance.id);fd.append('file',file);const res=await fetch('/api/admin/guidance-attachments',{method:'POST',body:fd});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Document attached.');}catch(err){setError(err.message)}finally{setBusy(false)}}
  async function removeGuidanceAttachment(id){if(!confirm('Remove this attachment?'))return;setBusy(true);setError('');try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'guidanceAttachmentDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Removed.');}catch(err){setError(err.message)}finally{setBusy(false)}}
  async function removeGuidance(id){if(!confirm('Delete this daily expectation? This cannot be undone.'))return;setBusy(true);setError('');try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'guidanceDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);setForms(f=>({...f,guidance:blank.guidance}));await load();setNotice('Deleted.');}catch(err){setError(err.message)}finally{setBusy(false)}}
  async function save(type,e){e.preventDefault();setBusy(true);setError('');setNotice('');const submitted=forms[type];try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,...submitted})});const json=await res.json();if(!res.ok)throw new Error(json.error);const fresh=await load();if(type==='guidance'&&fresh){const savedId=json.id||submitted.id;const savedItem=fresh.guidance.find(g=>String(g.id)===String(savedId));setForms(f=>({...f,guidance:savedItem?{id:savedItem.id,scopeType:savedItem.scope_type,role:savedItem.role||'employee',departmentId:savedItem.department_id||'',jobId:savedItem.job_id||'',title:savedItem.title,instructions:savedItem.instructions||'',dailyGoal:savedItem.daily_goal||''}:blank.guidance}));setNotice('Guidance saved — attach documents below if needed, or add another.');}else{setForms(f=>({...f,[type]:blank[type]}));setNotice(`${type[0].toUpperCase()+type.slice(1)} saved.`);}}catch(err){setError(err.message)}finally{setBusy(false)}}
  function csvValue(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
  function exportMaterials(){const rows=['item_code,description,unit_of_measure,standard_cost',...data.materials.map(m=>[m.item_code,m.description,m.unit_of_measure,m.standard_cost??''].map(csvValue).join(','))];const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='mastercraft-materials.csv';a.click();URL.revokeObjectURL(url);}
  function downloadTemplate(){const url=URL.createObjectURL(new Blob(['item_code,description,unit_of_measure,standard_cost\nMAT-1001,Example material,EA,12.50'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='mastercraft-material-template.csv';a.click();URL.revokeObjectURL(url);}
  function parseCsv(text){const firstLine=(text.split(/\r?\n/)[0]||'');const delimiter=firstLine.includes('\t')?'\t':firstLine.split(';').length>firstLine.split(',').length?';':',';const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)throw new Error('Your file needs a header row and at least one material. Download the template if needed.');const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));const value=(r,...names)=>r[headers.findIndex(h=>names.includes(h))]||'';const materials=rows.map(r=>({itemCode:value(r,'item_code','itemcode','code','item_number','part_number','material_code','material_number','sku'),description:value(r,'description','item_description','item_name','material_description','name'),unitOfMeasure:value(r,'unit_of_measure','uom','unit','unitofmeasure'),standardCost:value(r,'standard_cost','cost','unit_cost','unit_price','price').replace(/[$,]/g,'')}));if(!materials.some(m=>m.itemCode&&m.description&&m.unitOfMeasure))throw new Error('I could not find item code, description, and unit columns. Use the template or rename your columns.');return materials;}
  async function importMaterials(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;setImporting(true);setError('');setNotice('');setImportFeedback('');try{if(!/\.(csv|txt)$/i.test(file.name))throw new Error('Please choose a CSV or text-delimited file. For Excel, use Save As → CSV first.');const materials=parseCsv(await file.text());const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'materialsImport',materials})});const json=await res.json();if(!res.ok)throw new Error(json.error);const message=`${json.imported} material${json.imported===1?'':'s'} imported or updated.${json.skipped?.length?` Skipped invalid rows: ${json.skipped.join(', ')}.`:''}`;setNotice(message);setImportFeedback(message);load();}catch(err){setError(err.message);setImportFeedback(err.message)}finally{setImporting(false)}}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}
  if(!data)return <main className="shell"><div className="container"><div className="card">Loading administration...</div></div></main>;
  return <main className="shell"><div className="topbar"><a className="brand" href="/admin"><BrandMark />MASTERCRAFT ADMIN</a><div className="navlinks"><a className="navlink" href="#guide">Guide</a><a className="navlink" href="#records">Records</a><a className="navlink" href="/admin/job">Jobs</a><a className="navlink" href="#shop-calendar">Calendar</a><a className="navlink" href="#materials">Materials</a><a className="navlink" href="/admin/costing">Job Costing</a><a className="navlink" href="/admin/payroll">Payroll</a><RoleNav current="admin" /><button className="toplink" onClick={logout}>Sign out</button></div></div><div className="container">
    <div className="card"><div className="kicker">Administration</div><h1>Shop setup</h1><p className="muted">Everything used to run the shop is managed here. Start with departments, then people, jobs, materials, and daily guidance.</p>{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}</div>
    <section id="guide" className="card guide"><div><div className="kicker">First-time guide</div><h2>Where to find things</h2><p className="muted">Tap a step to open its form. Use <strong>Records</strong> to view everything already in the system.</p></div><div className="guide-links"><button type="button" onClick={()=>{openForm('departments');document.getElementById('departments')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>1. Departments</strong><span>Create shop areas such as Fabrication or Shipping.</span></button><button type="button" onClick={()=>{openForm('team');document.getElementById('team')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>2. Team</strong><span>Add people, select their department and role, and set a PIN.</span></button><button type="button" onClick={()=>{openForm('materials');document.getElementById('materials')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>3. Materials</strong><span>Add one item or import/export the whole list in a CSV file, so you have them ready to plan onto jobs.</span></button><a href="/admin/job"><strong>4. Job Setup</strong><span>Create a job, then add its schedule, planned materials, and daily expectations all in one place. Open the Supervisor Board (top right) afterward to assign people to each step — that is what makes it show up on their phone.</span></a><button type="button" onClick={()=>{openForm('guidance');document.getElementById('guidance')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>5. Daily expectations</strong><span>Set instructions and goals for a whole role or department (for a specific job, use Job Setup instead).</span></button><a href="#records"><strong>6. View records</strong><span>Browse all jobs, operations, materials, guidance, and people.</span></a><a href="/admin/costing"><strong>7. Job costing</strong><span>See actual hours and material cost logged against each job, and export to CSV/Google Sheets.</span></a><a href="/admin/payroll"><strong>8. Payroll &amp; corrections</strong><span>Fix a missed clock-in/out or material entry, pull total hours per employee for payroll, and see who clocked in.</span></a></div></section>
    <div className="grid two">
      <div id="team" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('team')}><span className="collapse-caret">{openForms.team?'▾':'▸'}</span><div><div className="kicker">People</div><h2>{forms.employee.id?'Edit employee':'Add employee'}</h2></div></button>
        {openForms.team?<form onSubmit={e=>save('employee',e)}><div className="field"><label>Employee code</label><input value={forms.employee.employeeCode} onChange={e=>change('employee','employeeCode',e.target.value)} placeholder="E1002" /></div><div className="field"><label>Full name</label><input value={forms.employee.fullName} onChange={e=>change('employee','fullName',e.target.value)} /></div><div className="field"><label>Department</label><select value={forms.employee.departmentId} onChange={e=>change('employee','departmentId',e.target.value)}><option value="">No department</option>{data.departments.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div className="grid two"><div className="field"><label>Role</label><select value={forms.employee.role} onChange={e=>change('employee','role',e.target.value)}><option value="employee">Employee</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div><div className="field"><label>{forms.employee.id?'Replacement PIN (leave blank to keep current)':'Initial PIN'}</label><input inputMode="numeric" type="password" value={forms.employee.pin} onChange={e=>change('employee','pin',e.target.value)} /></div></div>{forms.employee.id?<label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}><input type="checkbox" style={{width:'auto'}} checked={forms.employee.active!==false} onChange={e=>change('employee','active',e.target.checked)} />Active (uncheck to block this person from logging in, without deleting their record)</label>:null}<button disabled={busy} className="btn primary">{forms.employee.id?'SAVE EMPLOYEE':'ADD EMPLOYEE'}</button>{forms.employee.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,employee:blank.employee}))}>CANCEL EDIT</button>:null}</form>:null}
      </div>
      <div id="departments" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('departments')}><span className="collapse-caret">{openForms.departments?'▾':'▸'}</span><div><div className="kicker">Organization</div><h2>{forms.department.id?'Edit department':'Departments'}</h2></div></button>
        {openForms.departments?<>
        <form onSubmit={e=>save('department',e)}><p className="muted">Create these first so employees and operations have a home.</p><div className="field"><label>Department name</label><input value={forms.department.name} onChange={e=>change('department','name',e.target.value)} placeholder="Welding" /></div>{forms.department.id?<label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}><input type="checkbox" style={{width:'auto'}} checked={forms.department.active!==false} onChange={e=>change('department','active',e.target.checked)} />Active (uncheck to hide from new team members and scheduling, without deleting it)</label>:null}<button disabled={busy} className="btn secondary">{forms.department.id?'SAVE DEPARTMENT':'ADD DEPARTMENT'}</button>{forms.department.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,department:blank.department}))}>CANCEL EDIT</button>:null}</form>
        <div className="table-wrap" style={{marginTop:'14px'}}><table className="table compact-table"><thead><tr><th>Name</th><th></th></tr></thead><tbody>{data.departments.map(d=><tr key={d.id}><td>{d.name}{d.active===false?<span className="badge"> inactive</span>:null}</td><td><button type="button" className="xref" onClick={()=>edit('department',d)}>Edit</button> <button type="button" className="xref" onClick={()=>toggleActive('department',d)}>{d.active===false?'Reactivate':'Deactivate'}</button> <button type="button" className="xref" onClick={()=>removeEntity('department',d.id,'department')}>Delete</button></td></tr>)}</tbody></table></div>
        </>:<div className="simple-list">{data.departments.map(d=><span className="badge" key={d.id}>{d.name}{d.active===false?' (inactive)':''}</span>)}</div>}
      </div>
      <div id="materials" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('materials')}><span className="collapse-caret">{openForms.materials?'▾':'▸'}</span><div><div className="kicker">Inventory</div><h2>{forms.material.id?'Edit material':'Materials'}</h2></div></button>
        {openForms.materials?<>
        <p className="muted">Add one item below, or use a CSV for your entire material list. Matching item codes are updated.</p><div className="bulk-actions"><button type="button" onClick={exportMaterials} className="btn secondary">EXPORT MATERIALS (CSV)</button><button type="button" onClick={downloadTemplate} className="btn secondary">DOWNLOAD CSV TEMPLATE</button></div><div className="field"><label>Import materials file</label><input className="csv-input" disabled={importing} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={importMaterials}/><p className="hint">Accepts comma, semicolon, or tab-delimited files. Excel files should be saved as CSV first.</p></div>{importFeedback&&<div className={importFeedback.includes('imported')?'alert success':'alert error'}>{importFeedback}</div>}<form onSubmit={e=>save('material',e)}><div className="field"><label>Item code</label><input value={forms.material.itemCode} onChange={e=>change('material','itemCode',e.target.value)} /></div><div className="field"><label>Description</label><input value={forms.material.description} onChange={e=>change('material','description',e.target.value)} /></div><div className="grid two"><div className="field"><label>Unit of measure</label><input value={forms.material.unitOfMeasure} onChange={e=>change('material','unitOfMeasure',e.target.value)} /></div><div className="field"><label>Standard cost</label><input inputMode="decimal" value={forms.material.standardCost} onChange={e=>change('material','standardCost',e.target.value)} /></div></div>{forms.material.id?<label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}><input type="checkbox" style={{width:'auto'}} checked={forms.material.active!==false} onChange={e=>change('material','active',e.target.checked)} />Active (uncheck to hide from the employee material list, without deleting it)</label>:null}<button disabled={busy} className="btn primary">{forms.material.id?'SAVE MATERIAL':'ADD MATERIAL'}</button>{forms.material.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,material:blank.material}))}>CANCEL EDIT</button>:null}</form>
        </>:<p className="muted">{data.materials.length} material{data.materials.length===1?'':'s'} in your catalog.</p>}
      </div>
      <div id="guidance" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('guidance')}><span className="collapse-caret">{openForms.guidance?'▾':'▸'}</span><div><div className="kicker">Daily expectations</div><h2>{forms.guidance.id?'Edit expectation':'Instructions & goals'}</h2></div></button>
        {openForms.guidance?<form onSubmit={e=>save('guidance',e)}>
        <p className="muted">For a specific job's department, set that from <a href="/admin/job">Job Setup</a> instead — this form is for a whole role or department.</p><div className="field"><label>Apply to</label><select value={forms.guidance.scopeType} onChange={e=>change('guidance','scopeType',e.target.value)}><option value="role">Role</option><option value="department">Department</option></select></div>
        {forms.guidance.scopeType==='role'?<div className="field"><label>Role</label><select value={forms.guidance.role} onChange={e=>change('guidance','role',e.target.value)}><option value="employee">Employee</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>:<div className="field"><label>Department</label><select value={forms.guidance.departmentId} onChange={e=>change('guidance','departmentId',e.target.value)}><option value="">Select department</option>{data.departments.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
        <div className="field"><label>Title</label><input value={forms.guidance.title} onChange={e=>change('guidance','title',e.target.value)} placeholder="Fabrication daily standard" /></div><div className="field"><label>Instructions</label><input value={forms.guidance.instructions} onChange={e=>change('guidance','instructions',e.target.value)} placeholder="Review work order before starting." /></div><div className="field"><label>Daily goal</label><input value={forms.guidance.dailyGoal} onChange={e=>change('guidance','dailyGoal',e.target.value)} placeholder="Complete assigned operations safely and accurately." /></div><button disabled={busy} className="btn secondary">SAVE GUIDANCE</button>{forms.guidance.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,guidance:blank.guidance}))}>DONE / NEW</button>:null}{forms.guidance.id?<button type="button" className="btn danger" onClick={()=>removeGuidance(forms.guidance.id)}>DELETE</button>:null}
        {forms.guidance.id?(()=>{const current=data.guidance.find(g=>String(g.id)===String(forms.guidance.id));const attachments=current?.attachments||[];return <div style={{marginTop:'14px',borderTop:'1px solid #e5e5e5',paddingTop:'14px'}}><div className="kicker">Attachments</div>{attachments.length===0?<p className="muted" style={{margin:'4px 0 10px'}}>No documents attached yet.</p>:<ul style={{margin:'4px 0 10px 20px',padding:0}}>{attachments.map(a=><li key={a.id}><a href={`/api/attachments/${a.id}`}>{a.filename}</a> <button type="button" className="xref" onClick={()=>removeGuidanceAttachment(a.id)}>remove</button></li>)}</ul>}<div className="field"><label>Attach a document</label><input className="csv-input" type="file" onChange={uploadGuidanceAttachment} /></div></div>;})():null}
        </form>:null}
      </div>
    </div>
    <section id="shop-calendar" className="card"><div className="kicker">Shop calendar</div><h2>Everything on the schedule</h2><p className="muted">A read-only overview of every job's scheduled operations. To add or change one, use <a href="/admin/job">Job Setup</a>.</p><div className="cal-card">
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
        const calOps=(data.operations||[]).filter(o=>o.planned_start).map(o=>{const start=parseDateOnly(o.planned_start);let end=o.planned_finish?parseDateOnly(o.planned_finish):start;if(end<start)end=start;return {raw:o,start,end};});
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
      {(data.operations||[]).every(o=>!o.planned_start)?<p className="muted" style={{marginTop:'10px'}}>No operations have planned dates yet — add a planned start date in <a href="/admin/job">Job Setup</a> to see it here.</p>:null}
    </div></section>
    <section id="records"><div className="section-heading"><div><div className="kicker">Reference library</div><h2>View shop records</h2><p className="muted">Look up existing jobs, materials, expectations, and people. Click a row to see everything linked to it, or edit it directly from there.</p></div></div>
      <div className="card" style={{marginBottom:'16px'}}><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='jobs'?' active':'')} onClick={()=>setRecordsTab('jobs')}>Jobs</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='scheduling'?' active':'')} onClick={()=>setRecordsTab('scheduling')}>Scheduling</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='team'?' active':'')} onClick={()=>setRecordsTab('team')}>Team</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='materials'?' active':'')} onClick={()=>setRecordsTab('materials')}>Materials</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='guidance'?' active':'')} onClick={()=>setRecordsTab('guidance')}>Daily guidance</button>
      </div></div>
      <div className="card">
        {recordsTab==='jobs'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Customer</th><th>Status</th><th></th></tr></thead><tbody>{data.jobs.length===0?<tr><td colSpan="4" className="muted">No jobs have been created yet.</td></tr>:data.jobs.map(j=><tr key={j.id} style={{cursor:'pointer',background:recordDetail?.type==='job'&&String(recordDetail.id)===String(j.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'job',id:j.id})}><td><strong>{j.job_number}</strong><br/><span className="muted">{j.description}</span></td><td>{j.customer_name||'—'}</td><td><span className="badge">{j.status.replaceAll('_',' ')}</span></td><td onClick={ev=>ev.stopPropagation()}><a className="xref" href={`/admin/job?job=${j.id}`}>Manage</a> <button type="button" className="xref" onClick={()=>removeEntity('job',j.id,'job')}>Delete</button></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='scheduling'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Operation</th><th>Dept</th><th>Est.</th><th>Planned</th><th>Status</th></tr></thead><tbody>{data.operations.length===0?<tr><td colSpan="6" className="muted">No operations have been scheduled yet.</td></tr>:data.operations.map(o=><tr key={o.id} style={{cursor:'pointer',background:recordDetail?.type==='operation'&&String(recordDetail.id)===String(o.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'operation',id:o.id})}><td><strong>{o.job_number}</strong></td><td>#{o.sequence_no} {o.operation_name}</td><td>{o.department_name}</td><td>{o.estimated_hours||'—'}</td><td>{fmtPlanned(o)}</td><td><span className={'badge '+(o.status==='in_progress'?'active':'')}>{String(o.status).replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='team'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Role</th><th></th></tr></thead><tbody>{data.employees.map(e=><tr key={e.id} style={{cursor:'pointer',background:recordDetail?.type==='employee'&&String(recordDetail.id)===String(e.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'employee',id:e.id})}><td>{e.employee_code}</td><td>{e.full_name}</td><td>{e.department_name||'—'}</td><td><span className="badge">{e.role}</span>{e.active===false?<span className="badge"> inactive</span>:null}</td><td onClick={ev=>ev.stopPropagation()}><button type="button" className="xref" onClick={()=>edit('employee',e)}>Edit</button> <button type="button" className="xref" onClick={()=>toggleActive('employee',e)}>{e.active===false?'Reactivate':'Deactivate'}</button> <button type="button" className="xref" onClick={()=>removeEntity('employee',e.id,'team member')}>Delete</button></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='materials'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Item code</th><th>Description</th><th>UOM</th><th>Cost</th><th>Status</th><th></th></tr></thead><tbody>{data.materials.length===0?<tr><td colSpan="6" className="muted">No materials have been added yet.</td></tr>:data.materials.map(m=><tr key={m.id} style={{cursor:'pointer',background:recordDetail?.type==='material'&&String(recordDetail.id)===String(m.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'material',id:m.id})}><td><strong>{m.item_code}</strong></td><td>{m.description}</td><td>{m.unit_of_measure}</td><td>{m.standard_cost==null?'—':`$${Number(m.standard_cost).toFixed(2)}`}</td><td>{m.active===false?<span className="badge">inactive</span>:null}</td><td onClick={ev=>ev.stopPropagation()}><button type="button" className="xref" onClick={()=>edit('material',m)}>Edit</button> <button type="button" className="xref" onClick={()=>toggleActive('material',m)}>{m.active===false?'Reactivate':'Deactivate'}</button> <button type="button" className="xref" onClick={()=>removeEntity('material',m.id,'material')}>Delete</button></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='guidance'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Applies to</th><th>Date</th><th>Title</th><th>Goal</th></tr></thead><tbody>{data.guidance.length===0?<tr><td colSpan="4" className="muted">No daily guidance has been created yet.</td></tr>:data.guidance.map(g=><tr key={g.id} style={{cursor:'pointer'}} onClick={()=>edit('guidance',g)}><td><span className="badge">{g.scope_type==='job'?`${g.job_number} · ${g.department_name}`:g.scope_type==='department'?g.department_name:g.role}</span></td><td>{g.scope_type==='job'?(g.guidance_date?String(g.guidance_date).slice(0,10):'Every day'):'—'}</td><td><strong>{g.title}</strong><br/><span className="muted">{g.instructions||'—'}</span>{g.attachments?.length>0?<div className="muted">{g.attachments.length} attachment{g.attachments.length===1?'':'s'}</div>:null}</td><td>{g.daily_goal||'—'}</td></tr>)}</tbody></table></div>:null}
      </div>
      {renderDetail()}
    </section>
  </div></main>;
}
