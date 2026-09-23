'use client';
import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '../components/BrandMark';
import RoleNav from '../components/RoleNav';

const blank = { employee:{id:'',employeeCode:'',fullName:'',role:'employee',pin:'',active:true}, job:{id:'',jobNumber:'',customerName:'',description:'',dueDate:'',priority:'3',status:'not_started'}, material:{id:'',itemCode:'',description:'',unitOfMeasure:'ea',standardCost:'',active:true}, jobMaterial:{id:'',jobId:'',materialId:'',plannedQuantity:'',notes:''} };
function hoursFmt(h){return (Math.round((h||0)*100)/100).toFixed(2);}
function money(n){return '$'+(Math.round((n||0)*100)/100).toFixed(2);}
function fmtDateTime(s){if(!s)return '—';const d=new Date(s);return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

export default function AdminPage(){
  const router=useRouter(); const [data,setData]=useState(null); const [forms,setForms]=useState(blank); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false); const [importing,setImporting]=useState(false); const [importFeedback,setImportFeedback]=useState(''); const [recordDetail,setRecordDetail]=useState(null); const [pendingScroll,setPendingScroll]=useState(false); const [openForms,setOpenForms]=useState({team:false,materials:false,danger:false}); const [recordsTab,setRecordsTab]=useState('jobs'); const [resetConfirm,setResetConfirm]=useState('');
  function openForm(name){setOpenForms(f=>({...f,[name]:true}));}
  function toggleForm(name){setOpenForms(f=>({...f,[name]:!f[name]}));}
  const detail=useMemo(()=>{
    if(!recordDetail||!data)return null;
    const {type,id}=recordDetail;
    if(type==='job'){
      const job=data.jobs.find(j=>String(j.id)===String(id)); if(!job)return null;
      const te=data.timeEntries.filter(t=>String(t.job_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.job_id)===String(id));
      const actualHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      const materialCost=mt.reduce((s,m)=>s+Number(m.quantity||0)*Number(m.unit_cost||0)*(m.transaction_type==='return'?-1:1),0);
      const jm=(data.jobMaterials||[]).filter(j=>String(j.job_id)===String(id));
      const plannedMaterialCost=jm.reduce((s,j)=>s+Number(j.planned_quantity||0)*Number(j.standard_cost||0),0);
      return {type,job,te,mt,jm,actualHours,materialCost,plannedMaterialCost};
    }
    if(type==='employee'){
      const employee=data.employees.find(e=>String(e.id)===String(id)); if(!employee)return null;
      const te=data.timeEntries.filter(t=>String(t.employee_id)===String(id));
      const mt=data.materialTransactions.filter(m=>String(m.employee_id)===String(id));
      const totalHours=te.reduce((s,t)=>s+Number(t.hours||0),0);
      return {type,employee,te,mt,totalHours};
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
  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);const d=params.get('detail');if(d){const dash=d.indexOf('-');const type=d.slice(0,dash),id=d.slice(dash+1);if(['job','employee','material'].includes(type)&&id){showRecord({type,id});}}}catch{}},[]);
  function change(type,key,value){setForms(f=>({...f,[type]:{...f[type],[key]:value}}));}

  function renderDetail(){
    if(!recordDetail)return null;
    if(!detail)return <div className="card empty" id="record-detail">That record could not be found — it may have been removed.<button type="button" className="btn secondary compact" onClick={()=>setRecordDetail(null)}>CLOSE</button></div>;
    const closeBtn=<button type="button" className="btn secondary compact" style={{marginTop:0}} onClick={()=>setRecordDetail(null)}>CLOSE</button>;
    const xref=(type,id,label)=>id?<button type="button" className="xref" onClick={()=>showRecord({type,id})}>{label}</button>:(label||'—');
    if(detail.type==='job'){
      const {job,te,mt,jm,actualHours,materialCost,plannedMaterialCost}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Job detail</div>{closeBtn}</div>
        <h2>{job.job_number} — {job.description}</h2>
        <p className="muted">{job.customer_name||'No customer on file'} · <span className="badge">{String(job.status).replaceAll('_',' ')}</span> · {hoursFmt(actualHours)} hours logged · {money(materialCost)} actual vs {money(plannedMaterialCost)} planned in materials · <a href="/admin/costing">Full costing view</a> · <a className="xref" href={`/admin/job?job=${job.id}`}>Manage in Job Setup</a></p>
        <div className="kicker" style={{marginTop:'14px'}}>Planned materials</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Planned qty</th><th>Planned cost</th><th>Notes</th><th></th></tr></thead><tbody>
          {jm.length===0?<tr><td colSpan="5" className="muted">No materials planned for this job yet.</td></tr>:jm.map(j=><tr key={j.id}><td>{xref('material',j.material_id,<><strong>{j.item_code}</strong> {j.material_description}</>)}</td><td>{j.planned_quantity} {j.unit_of_measure}</td><td>{money(Number(j.planned_quantity||0)*Number(j.standard_cost||0))}</td><td>{j.notes||'—'}</td><td><a className="xref" href={`/admin/job?job=${job.id}`}>Edit</a></td></tr>)}
        </tbody></table></div>
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
      const {employee,te,mt,totalHours}=detail;
      return <div className="card" id="record-detail"><div className="row"><div className="kicker">Employee detail</div>{closeBtn}</div>
        <h2>{employee.full_name} <span className="muted">({employee.employee_code})</span></h2>
        <p className="muted"><span className="badge">{employee.role}</span>{employee.active===false?<span className="badge"> inactive</span>:null} · {hoursFmt(totalHours)} hours logged total</p>
        <div className="kicker" style={{marginTop:'14px'}}>Time logged</div>
        <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Started</th><th>Stopped</th><th>Hours</th></tr></thead><tbody>
          {te.length===0?<tr><td colSpan="4" className="muted">No time logged yet.</td></tr>:te.map(t=><tr key={t.id}><td>{xref('job',t.job_id,t.job_number||'—')}</td><td>{fmtDateTime(t.started_at)}</td><td>{t.stopped_at?fmtDateTime(t.stopped_at):<span className="badge active">still running</span>}</td><td>{hoursFmt(t.hours)}</td></tr>)}
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
    const jobForSetup=type==='job'?item.id:(type==='jobMaterial')?item.job_id:null;
    if(jobForSetup){router.push(`/admin/job?job=${jobForSetup}`);return;}
    const values=type==='employee'?{id:item.id,employeeCode:item.employee_code,fullName:item.full_name,role:item.role,pin:'',active:item.active}:{id:item.id,itemCode:item.item_code,description:item.description,unitOfMeasure:item.unit_of_measure,standardCost:item.standard_cost??'',active:item.active};
    setForms(f=>({...f,[type]:values}));
    const formName=type==='employee'?'team':'materials';
    openForm(formName);
    document.getElementById(formName)?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function toggleActive(type,item){
    setBusy(true);setError('');setNotice('');
    const nextActive=item.active===false;
    try{
      const body=type==='employee'?{type:'employee',id:item.id,employeeCode:item.employee_code,fullName:item.full_name,role:item.role,pin:'',active:nextActive}
        :{type:'material',id:item.id,itemCode:item.item_code,description:item.description,unitOfMeasure:item.unit_of_measure,standardCost:item.standard_cost??'',active:nextActive};
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const json=await res.json();if(!res.ok)throw new Error(json.error);
      await load();
      setNotice(nextActive?'Reactivated.':'Deactivated.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function resetAllData(){
    if(resetConfirm!=='RESET'){setError('Type RESET (all caps) in the box to confirm.');return;}
    if(!confirm('This permanently deletes every job, planned material, time entry, material transaction, and team member. Only the login you\'re using right now will be kept. This cannot be undone. Continue?'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'resetAllData',confirm:resetConfirm})});
      const json=await res.json();if(!res.ok)throw new Error(json.error);
      setResetConfirm('');
      setRecordDetail(null);
      setForms(blank);
      await load();
      setNotice('All test data cleared. Your login was kept — everything else is empty and ready for your real setup.');
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
  async function save(type,e){e.preventDefault();setBusy(true);setError('');setNotice('');const submitted=forms[type];try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,...submitted})});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setForms(f=>({...f,[type]:blank[type]}));setNotice(`${type[0].toUpperCase()+type.slice(1)} saved.`);}catch(err){setError(err.message)}finally{setBusy(false)}}
  function csvValue(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
  function exportMaterials(){const rows=['item_code,description,unit_of_measure,standard_cost',...data.materials.map(m=>[m.item_code,m.description,m.unit_of_measure,m.standard_cost??''].map(csvValue).join(','))];const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='mastercraft-materials.csv';a.click();URL.revokeObjectURL(url);}
  function downloadTemplate(){const url=URL.createObjectURL(new Blob(['item_code,description,unit_of_measure,standard_cost\nMAT-1001,Example material,EA,12.50'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='mastercraft-material-template.csv';a.click();URL.revokeObjectURL(url);}
  function parseCsv(text){const firstLine=(text.split(/\r?\n/)[0]||'');const delimiter=firstLine.includes('\t')?'\t':firstLine.split(';').length>firstLine.split(',').length?';':',';const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)throw new Error('Your file needs a header row and at least one material. Download the template if needed.');const headers=rows.shift().map(x=>x.replace(/^﻿/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));const value=(r,...names)=>r[headers.findIndex(h=>names.includes(h))]||'';const materials=rows.map(r=>({itemCode:value(r,'item_code','itemcode','code','item_number','part_number','material_code','material_number','sku'),description:value(r,'description','item_description','item_name','material_description','name'),unitOfMeasure:value(r,'unit_of_measure','uom','unit','unitofmeasure'),standardCost:value(r,'standard_cost','cost','unit_cost','unit_price','price').replace(/[$,]/g,'')}));if(!materials.some(m=>m.itemCode&&m.description&&m.unitOfMeasure))throw new Error('I could not find item code, description, and unit columns. Use the template or rename your columns.');return materials;}
  async function importMaterials(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;setImporting(true);setError('');setNotice('');setImportFeedback('');try{if(!/\.(csv|txt)$/i.test(file.name))throw new Error('Please choose a CSV or text-delimited file. For Excel, use Save As → CSV first.');const materials=parseCsv(await file.text());const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'materialsImport',materials})});const json=await res.json();if(!res.ok)throw new Error(json.error);const message=`${json.imported} material${json.imported===1?'':'s'} imported or updated.${json.skipped?.length?` Skipped invalid rows: ${json.skipped.join(', ')}.`:''}`;setNotice(message);setImportFeedback(message);load();}catch(err){setError(err.message);setImportFeedback(err.message)}finally{setImporting(false)}}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}
  if(!data)return <main className="shell"><div className="container"><div className="card">Loading administration...</div></div></main>;
  return <main className="shell"><div className="topbar"><a className="brand" href="/admin"><BrandMark />MASTERCRAFT ADMIN</a><div className="navlinks"><a className="navlink" href="#guide">Guide</a><a className="navlink" href="#records">Records</a><a className="navlink" href="/admin/job">Jobs</a><a className="navlink" href="#materials">Materials</a><a className="navlink" href="/admin/costing">Job Costing</a><a className="navlink" href="/admin/payroll">Payroll</a><RoleNav current="admin" /><button className="toplink" onClick={logout}>Sign out</button></div></div><div className="container">
    <div className="card"><div className="kicker">Administration</div><h1>Shop setup</h1><p className="muted">Everything used to run the shop is managed here. Add your team, your materials, and your jobs — then everyone clocks in and logs materials from their phone.</p>{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}</div>
    <section id="guide" className="card guide"><div><div className="kicker">First-time guide</div><h2>Where to find things</h2><p className="muted">Tap a step to open its form. Use <strong>Records</strong> to view everything already in the system.</p></div><div className="guide-links"><button type="button" onClick={()=>{openForm('team');document.getElementById('team')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>1. Team</strong><span>Add people, set their role, and give them a PIN.</span></button><button type="button" onClick={()=>{openForm('materials');document.getElementById('materials')?.scrollIntoView({behavior:'smooth',block:'start'});}}><strong>2. Materials</strong><span>Add one item or import/export the whole list in a CSV file, so you have them ready to plan onto jobs.</span></button><a href="/admin/job"><strong>3. Job Setup</strong><span>Create a job, then list the materials it needs — all in one place.</span></a><a href="#records"><strong>4. View records</strong><span>Browse all jobs, materials, and people.</span></a><a href="/admin/costing"><strong>5. Job costing</strong><span>See actual hours and material cost logged against each job, and export to CSV/Google Sheets.</span></a><a href="/admin/payroll"><strong>6. Payroll &amp; corrections</strong><span>Fix a missed clock-in/out or material entry, pull total hours per employee for payroll, and see who clocked in.</span></a></div></section>
    <div className="grid two">
      <div id="team" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('team')}><span className="collapse-caret">{openForms.team?'▾':'▸'}</span><div><div className="kicker">People</div><h2>{forms.employee.id?'Edit employee':'Add employee'}</h2></div></button>
        {openForms.team?<form onSubmit={e=>save('employee',e)}><div className="field"><label>Employee code</label><input value={forms.employee.employeeCode} onChange={e=>change('employee','employeeCode',e.target.value)} placeholder="E1002" /></div><div className="field"><label>Full name</label><input value={forms.employee.fullName} onChange={e=>change('employee','fullName',e.target.value)} /></div><div className="grid two"><div className="field"><label>Role</label><select value={forms.employee.role} onChange={e=>change('employee','role',e.target.value)}><option value="employee">Employee</option><option value="admin">Admin</option></select></div><div className="field"><label>{forms.employee.id?'Replacement PIN (leave blank to keep current)':'Initial PIN'}</label><input inputMode="numeric" type="password" value={forms.employee.pin} onChange={e=>change('employee','pin',e.target.value)} /></div></div>{forms.employee.id?<label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}><input type="checkbox" style={{width:'auto'}} checked={forms.employee.active!==false} onChange={e=>change('employee','active',e.target.checked)} />Active (uncheck to block this person from logging in, without deleting their record)</label>:null}<button disabled={busy} className="btn primary">{forms.employee.id?'SAVE EMPLOYEE':'ADD EMPLOYEE'}</button>{forms.employee.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,employee:blank.employee}))}>CANCEL EDIT</button>:null}</form>:null}
      </div>
      <div id="materials" className="card">
        <button type="button" className="collapse-toggle" onClick={()=>toggleForm('materials')}><span className="collapse-caret">{openForms.materials?'▾':'▸'}</span><div><div className="kicker">Inventory</div><h2>{forms.material.id?'Edit material':'Materials'}</h2></div></button>
        {openForms.materials?<>
        <p className="muted">Add one item below, or use a CSV for your entire material list. Matching item codes are updated.</p><div className="bulk-actions"><button type="button" onClick={exportMaterials} className="btn secondary">EXPORT MATERIALS (CSV)</button><button type="button" onClick={downloadTemplate} className="btn secondary">DOWNLOAD CSV TEMPLATE</button></div><div className="field"><label>Import materials file</label><input className="csv-input" disabled={importing} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={importMaterials}/><p className="hint">Accepts comma, semicolon, or tab-delimited files. Excel files should be saved as CSV first.</p></div>{importFeedback&&<div className={importFeedback.includes('imported')?'alert success':'alert error'}>{importFeedback}</div>}<form onSubmit={e=>save('material',e)}><div className="field"><label>Item code</label><input value={forms.material.itemCode} onChange={e=>change('material','itemCode',e.target.value)} /></div><div className="field"><label>Description</label><input value={forms.material.description} onChange={e=>change('material','description',e.target.value)} /></div><div className="grid two"><div className="field"><label>Unit of measure</label><input value={forms.material.unitOfMeasure} onChange={e=>change('material','unitOfMeasure',e.target.value)} /></div><div className="field"><label>Standard cost</label><input inputMode="decimal" value={forms.material.standardCost} onChange={e=>change('material','standardCost',e.target.value)} /></div></div>{forms.material.id?<label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}><input type="checkbox" style={{width:'auto'}} checked={forms.material.active!==false} onChange={e=>change('material','active',e.target.checked)} />Active (uncheck to hide from the employee material list, without deleting it)</label>:null}<button disabled={busy} className="btn primary">{forms.material.id?'SAVE MATERIAL':'ADD MATERIAL'}</button>{forms.material.id?<button type="button" className="btn secondary" onClick={()=>setForms(f=>({...f,material:blank.material}))}>CANCEL EDIT</button>:null}</form>
        </>:<p className="muted">{data.materials.length} material{data.materials.length===1?'':'s'} in your catalog.</p>}
      </div>
    </div>
    <section id="records"><div className="section-heading"><div><div className="kicker">Reference library</div><h2>View shop records</h2><p className="muted">Look up existing jobs, materials, and people. Click a row to see everything linked to it, or edit it directly from there.</p></div></div>
      <div className="card" style={{marginBottom:'16px'}}><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='jobs'?' active':'')} onClick={()=>setRecordsTab('jobs')}>Jobs</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='team'?' active':'')} onClick={()=>setRecordsTab('team')}>Team</button>
        <button type="button" className={'cal-nav-btn'+(recordsTab==='materials'?' active':'')} onClick={()=>setRecordsTab('materials')}>Materials</button>
      </div></div>
      <div className="card">
        {recordsTab==='jobs'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Job</th><th>Customer</th><th>Status</th><th></th></tr></thead><tbody>{data.jobs.length===0?<tr><td colSpan="4" className="muted">No jobs have been created yet.</td></tr>:data.jobs.map(j=><tr key={j.id} style={{cursor:'pointer',background:recordDetail?.type==='job'&&String(recordDetail.id)===String(j.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'job',id:j.id})}><td><strong>{j.job_number}</strong><br/><span className="muted">{j.description}</span></td><td>{j.customer_name||'—'}</td><td><span className="badge">{j.status.replaceAll('_',' ')}</span></td><td onClick={ev=>ev.stopPropagation()}><a className="xref" href={`/admin/job?job=${j.id}`}>Manage</a> <button type="button" className="xref" onClick={()=>removeEntity('job',j.id,'job')}>Delete</button></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='team'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Code</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody>{data.employees.map(e=><tr key={e.id} style={{cursor:'pointer',background:recordDetail?.type==='employee'&&String(recordDetail.id)===String(e.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'employee',id:e.id})}><td>{e.employee_code}</td><td>{e.full_name}</td><td><span className="badge">{e.role}</span>{e.active===false?<span className="badge"> inactive</span>:null}</td><td onClick={ev=>ev.stopPropagation()}><button type="button" className="xref" onClick={()=>edit('employee',e)}>Edit</button> <button type="button" className="xref" onClick={()=>toggleActive('employee',e)}>{e.active===false?'Reactivate':'Deactivate'}</button> <button type="button" className="xref" onClick={()=>removeEntity('employee',e.id,'team member')}>Delete</button></td></tr>)}</tbody></table></div>:null}
        {recordsTab==='materials'?<div className="table-wrap"><table className="table compact-table"><thead><tr><th>Item code</th><th>Description</th><th>UOM</th><th>Cost</th><th>Status</th><th></th></tr></thead><tbody>{data.materials.length===0?<tr><td colSpan="6" className="muted">No materials have been added yet.</td></tr>:data.materials.map(m=><tr key={m.id} style={{cursor:'pointer',background:recordDetail?.type==='material'&&String(recordDetail.id)===String(m.id)?'#f3f4f6':undefined}} onClick={()=>showRecord({type:'material',id:m.id})}><td><strong>{m.item_code}</strong></td><td>{m.description}</td><td>{m.unit_of_measure}</td><td>{m.standard_cost==null?'—':`$${Number(m.standard_cost).toFixed(2)}`}</td><td>{m.active===false?<span className="badge">inactive</span>:null}</td><td onClick={ev=>ev.stopPropagation()}><button type="button" className="xref" onClick={()=>edit('material',m)}>Edit</button> <button type="button" className="xref" onClick={()=>toggleActive('material',m)}>{m.active===false?'Reactivate':'Deactivate'}</button> <button type="button" className="xref" onClick={()=>removeEntity('material',m.id,'material')}>Delete</button></td></tr>)}</tbody></table></div>:null}
      </div>
      {renderDetail()}
    </section>
    <div id="danger-zone" className="card" style={{borderColor:'#c01311'}}>
      <button type="button" className="collapse-toggle" onClick={()=>toggleForm('danger')}><span className="collapse-caret">{openForms.danger?'▾':'▸'}</span><div><div className="kicker">Danger zone</div><h2>Clear all data</h2></div></button>
      {openForms.danger?<div>
        <p className="muted">Permanently deletes every job, planned material, time entry, material transaction, and team member — a full reset back to an empty app. Your own login stays so you can sign back in afterward. This cannot be undone.</p>
        <div className="field"><label>Type RESET to confirm</label><input value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)} placeholder="RESET" /></div>
        <button type="button" disabled={busy||resetConfirm!=='RESET'} className="btn danger" onClick={resetAllData}>PERMANENTLY DELETE ALL DATA</button>
      </div>:null}
    </div>
  </div></main>;
}
