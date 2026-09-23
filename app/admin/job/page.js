'use client';
import '../../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '../../components/BrandMark';
import RoleNav from '../../components/RoleNav';

const blankJob = { id:'', jobNumber:'', customerName:'', description:'', dueDate:'', priority:'3', status:'not_started' };
const blankJobMaterial = { id:'', jobId:'', materialId:'', plannedQuantity:'', notes:'' };

export default function JobSetupPage(){
  const router=useRouter();
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [jobId,setJobId]=useState('');
  const [jobForm,setJobForm]=useState(blankJob);
  const [jobMaterialForm,setJobMaterialForm]=useState(blankJobMaterial);

  const load=useCallback(async()=>{const res=await fetch('/api/admin/setup',{cache:'no-store'});if(res.status===401||res.status===403){router.push('/login');return null;}const json=await res.json();if(!res.ok){setError(json.error);return null;}setData(json);return json;},[router]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);const j=params.get('job');if(j)selectJob(j);}catch{}},[]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectJob(id){
    const nid=id?String(id):'';
    setJobId(nid);
    setJobForm(blankJob);
    if(nid)setJobMaterialForm({...blankJobMaterial,jobId:nid});
  }

  function editJob(job){setJobForm({id:job.id,jobNumber:job.job_number,customerName:job.customer_name||'',description:job.description||'',dueDate:job.due_date?String(job.due_date).slice(0,10):'',priority:String(job.priority||3),status:job.status||'not_started'});}
  function editJobMaterial(jm){setJobMaterialForm({id:jm.id,jobId:String(jm.job_id),materialId:String(jm.material_id),plannedQuantity:String(jm.planned_quantity),notes:jm.notes||''});}

  async function saveJob(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'job',...jobForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      const fresh=await load();
      const wasEdit=!!jobForm.id;
      const created=wasEdit?fresh.jobs.find(j=>String(j.id)===String(jobForm.id)):fresh.jobs.find(j=>j.job_number===String(jobForm.jobNumber).trim().toUpperCase());
      if(created)selectJob(created.id);
      setNotice(wasEdit?'Job saved.':'Job created — add its planned materials below.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function saveJobMaterial(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const wasEdit=!!jobMaterialForm.id;
      const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'jobMaterial',...jobMaterialForm})});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error);
      await load();
      setJobMaterialForm({...blankJobMaterial,jobId});
      setNotice(wasEdit?'Material line saved.':'Material planned for this job — add another, or move on.');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function removeJobMaterial(id){
    if(!confirm('Remove this planned material from the job?'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'jobMaterialDelete',id})});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();setNotice('Removed.');}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});router.push('/login');router.refresh();}

  const job=useMemo(()=>data?.jobs.find(j=>String(j.id)===String(jobId))||null,[data,jobId]);
  const materialsForJob=useMemo(()=>job?data.jobMaterials.filter(jm=>String(jm.job_id)===String(jobId)):[],[data,job,jobId]);

  if(!data)return <main className="shell"><div className="container"><div className="card">{error?<div className="alert error">{error}</div>:'Loading job setup...'}</div></div></main>;

  return <main className="shell">
    <div className="topbar">
      <a className="brand" href="/admin"><BrandMark />MASTERCRAFT ADMIN</a>
      <div className="navlinks">
        <a className="navlink" href="/admin">Setup</a>
        <a className="navlink" href="/admin#records">Records</a>
        <a className="navlink" href="/admin/costing">Job Costing</a>
        <a className="navlink" href="/admin/payroll">Payroll</a>
        <RoleNav current="admin" />
        <button className="toplink" onClick={logout}>Sign out</button>
      </div>
    </div>
    <div className="container">
      <div className="card">
        <div className="kicker">Job Setup</div>
        <h1>Set up a job</h1>
        <p className="muted">Pick an existing job, or add a new one — then list the materials it needs, all on this one page.</p>
        {error&&<div className="alert error">{error}</div>}
        {notice&&<div className="alert success">{notice}</div>}
      </div>

      <div className="card">
        <div className="field"><label>Existing job</label><select value={jobId} onChange={e=>selectJob(e.target.value)}><option value="">— Select a job —</option>{data.jobs.map(j=><option key={j.id} value={j.id}>{j.job_number} — {j.description}</option>)}</select></div>
        <form onSubmit={saveJob}>
          <div className="kicker" style={{marginTop:'16px'}}>{jobForm.id?'Edit job details':'Or add a new job'}</div>
          <div className="field"><label>Job number</label><input value={jobForm.jobNumber} onChange={e=>setJobForm(f=>({...f,jobNumber:e.target.value}))} placeholder="MC-26052" /></div>
          <div className="field"><label>Customer</label><input value={jobForm.customerName} onChange={e=>setJobForm(f=>({...f,customerName:e.target.value}))} /></div>
          <div className="field"><label>Description</label><input value={jobForm.description} onChange={e=>setJobForm(f=>({...f,description:e.target.value}))} /></div>
          <div className="grid two"><div className="field"><label>Due date</label><input type="date" value={jobForm.dueDate} onChange={e=>setJobForm(f=>({...f,dueDate:e.target.value}))} /></div><div className="field"><label>Priority</label><select value={jobForm.priority} onChange={e=>setJobForm(f=>({...f,priority:e.target.value}))}>{[1,2,3,4,5].map(p=><option key={p} value={p}>{p}</option>)}</select></div></div>
          {jobForm.id?<div className="field"><label>Status</label><select value={jobForm.status} onChange={e=>setJobForm(f=>({...f,status:e.target.value}))}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="complete">Complete</option><option value="closed">Closed (hides from employees)</option></select></div>:null}
          <button disabled={busy} className="btn primary">{jobForm.id?'SAVE JOB':'ADD JOB'}</button>{jobForm.id?<button type="button" className="btn secondary" onClick={()=>setJobForm(blankJob)}>CANCEL EDIT</button>:null}
        </form>
      </div>

      {!job?<div className="card"><p className="muted">Select or add a job above to manage its planned materials.</p></div>:<>
        <div className="card">
          <div className="alert" style={{background:'#f4f4f4'}}><strong>{job.job_number}</strong> — {job.description} · {job.customer_name||'No customer'} · <span className="badge">{job.status.replaceAll('_',' ')}</span> · <button type="button" className="xref" onClick={()=>editJob(job)}>edit job details</button> · <a href={`/admin?detail=job-${job.id}#records`}>view full record</a></div>
        </div>

        <section className="card">
          <div className="kicker">Planned materials — {job.job_number}</div>
          <p className="muted">This is a plan, not a transaction — your team still records what's actually pulled from the Employee material screen, and Job Costing will show planned vs. actual side by side.</p>
          <div className="table-wrap"><table className="table compact-table"><thead><tr><th>Material</th><th>Planned qty</th><th>Notes</th><th></th></tr></thead><tbody>
            {materialsForJob.length===0?<tr><td colSpan="4" className="muted">Nothing planned yet — add below.</td></tr>:materialsForJob.map(jm=><tr key={jm.id}><td><strong>{jm.item_code}</strong> {jm.material_description}</td><td>{jm.planned_quantity} {jm.unit_of_measure}</td><td>{jm.notes||'—'}</td><td><button type="button" className="xref" onClick={()=>editJobMaterial(jm)}>Edit</button> · <button type="button" className="xref" onClick={()=>removeJobMaterial(jm.id)}>Remove</button></td></tr>)}
          </tbody></table></div>
          <form onSubmit={saveJobMaterial}>
            <div className="grid two"><div className="field"><label>Material</label><select value={jobMaterialForm.materialId} onChange={e=>setJobMaterialForm(f=>({...f,materialId:e.target.value}))}><option value="">Select material</option>{data.materials.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.item_code} — {m.description} ({m.unit_of_measure})</option>)}</select></div><div className="field"><label>Planned quantity</label><input inputMode="decimal" value={jobMaterialForm.plannedQuantity} onChange={e=>setJobMaterialForm(f=>({...f,plannedQuantity:e.target.value}))} placeholder="10" /></div></div>
            <div className="field"><label>Notes (optional)</label><input value={jobMaterialForm.notes} onChange={e=>setJobMaterialForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. cut to 24 in lengths" /></div>
            <button disabled={busy} className="btn primary">{jobMaterialForm.id?'SAVE':'ADD TO JOB'}</button>{jobMaterialForm.id?<button type="button" className="btn secondary" onClick={()=>setJobMaterialForm({...blankJobMaterial,jobId})}>CANCEL EDIT</button>:null}
          </form>
          <p className="hint">Adding the same material again updates its planned quantity instead of duplicating the line.</p>
        </section>
      </>}
    </div>
  </main>;
}
